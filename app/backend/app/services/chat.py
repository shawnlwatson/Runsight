"""Runsight Assistant: a tool-calling loop over Vercel AI Gateway, streamed to the browser as NDJSON events."""

import json
import logging
import os
from collections.abc import Iterator
from datetime import date

import openai

from app.models.chat import ChatRequest
from app.services.chat_tools import TOOL_DEFINITIONS, AnalysisScope, run_tool

logger = logging.getLogger(__name__)

GATEWAY_URL = "https://ai-gateway.vercel.sh/v1"
DEFAULT_MODEL = "anthropic/claude-haiku-5.5"  # any tool-capable id from https://ai-gateway.vercel.sh/v1/models
MAX_STEPS = 6  # model calls per question; the last one may not call tools
MAX_OUTPUT_TOKENS = 1200

TOOL_STATUS = {
    "summarize_period": "Summarizing the period…",
    "list_runs": "Looking through your runs…",
    "metric_stats": "Calculating statistics…",
    "correlate": "Measuring the relationship…",
    "compare_run": "Comparing that run with the rest…",
}

SYSTEM_PROMPT = """You are Runsight Assistant, built into Runsight, a running analytics app for casual and \
recreational-competitive runners. You help one runner understand their own data. Today is {today}.

The runner's current selection: {scope}. Tools only see runs in this selection (dates can be narrowed or \
changed with the start and end arguments; the other filters and exclusions always apply). Mention the \
selection when it limits the answer.

How to answer:
- Always use the tools for numbers. Never invent or estimate values the tools did not return.
- Show patterns and let the runner draw conclusions. Offer a suggestion only when asked or when the evidence \
is clear, and frame it as something to try, not an instruction.
- State how strong the evidence is: how many runs support it, and for relationships the correlation, its \
interval, and the tool's evidence label. Say plainly when the data is too sparse or inconclusive.
- Correlation does not show cause. Weather, sleep, and fatigue overlap with season, route, and effort.
- Pace is minutes per mile and lower is faster. Write pace as m:ss /mi.
- Sleep, steps, and active energy come from daily health records, and some of those days are synthetic test \
data rather than measurements. Mention this when a conclusion depends on them.
- When an answer uses temperature or humidity, end with: "Weather data by Open-Meteo.com (CC BY 4.0) where the \
watch did not record it."
- Be concise: usually under 180 words. Plain text, short paragraphs, "- " bullets, and **bold** only. \
No tables or headings.
- Stay on running, training, and this runner's data. You are not a doctor; for pain, injury, or medical \
questions, suggest a professional."""


class AssistantUnavailable(RuntimeError):
    """No AI Gateway credentials are configured."""


def gateway_token(oidc_header: str | None):
    """API key for local runs; on Vercel, the deployment's OIDC token authenticates to the gateway."""
    token = os.getenv("AI_GATEWAY_API_KEY") or oidc_header or os.getenv("VERCEL_OIDC_TOKEN")
    if not token:
        raise AssistantUnavailable("Set AI_GATEWAY_API_KEY, or deploy on Vercel to use OIDC")
    return token


def make_client(token: str):
    return openai.OpenAI(api_key=token, base_url=GATEWAY_URL, timeout=60, max_retries=1)


def event(kind: str, **fields):
    return json.dumps({"type": kind, **fields}) + "\n"


def error_message(error: openai.OpenAIError):
    """A short explanation the runner can act on. Details stay in the server log."""
    status = getattr(error, "status_code", None)
    if isinstance(error, (openai.APIConnectionError, openai.APITimeoutError)):
        return "The assistant could not reach the AI service. Try again in a moment."
    if status == 429:
        return "The assistant is getting too many requests right now. Wait a minute and try again."
    if status == 402:
        return "The assistant has used its AI credits for now. Try again later."
    if status in (401, 403):
        return "The assistant is not set up correctly (AI Gateway authentication failed)."
    return "The assistant ran into a problem answering. Try again."


def stream_chat(request: ChatRequest, scope: AnalysisScope, client: openai.OpenAI) -> Iterator[str]:
    model = os.getenv("AI_GATEWAY_MODEL") or DEFAULT_MODEL
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT.format(today=date.today(), scope=scope.describe())}]
    messages += [{"role": message.role, "content": message.content} for message in request.messages]
    wrote_text = False
    try:
        for step in range(MAX_STEPS):
            last_step = step == MAX_STEPS - 1
            stream = client.chat.completions.create(
                model=model, messages=messages, tools=TOOL_DEFINITIONS, tool_choice="none" if last_step else "auto",
                max_completion_tokens=MAX_OUTPUT_TOKENS, stream=True)
            text, calls = [], {}
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta.content:
                    if not text and wrote_text:
                        yield event("delta", text="\n\n")  # separate text written before an earlier tool call
                    text.append(delta.content)
                    wrote_text = True
                    yield event("delta", text=delta.content)
                # Tool calls arrive in pieces, keyed by index
                for piece in delta.tool_calls or []:
                    call = calls.setdefault(piece.index, {"id": "", "name": "", "arguments": ""})
                    if piece.id:
                        call["id"] = piece.id
                    if piece.function and piece.function.name:
                        call["name"] += piece.function.name
                    if piece.function and piece.function.arguments:
                        call["arguments"] += piece.function.arguments
            if not calls:
                break
            messages.append({"role": "assistant", "content": "".join(text) or None, "tool_calls": [
                {"id": call["id"], "type": "function", "function": {"name": call["name"], "arguments": call["arguments"]}}
                for call in calls.values()]})
            for call in calls.values():
                yield event("status", message=TOOL_STATUS.get(call["name"], "Checking your data…"))
                messages.append({"role": "tool", "tool_call_id": call["id"], "content": run_tool(scope, call["name"], call["arguments"])})
        if not wrote_text:
            yield event("error", message="The assistant did not produce an answer. Try rephrasing the question.")
            return
        yield event("done")
    except openai.OpenAIError as error:
        logger.warning("AI Gateway request failed: %r", error)
        yield event("error", message=error_message(error))
    except Exception:
        logger.exception("Assistant failed")
        yield event("error", message="The assistant ran into a problem answering. Try again.")
