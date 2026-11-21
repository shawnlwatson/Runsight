"use client";

import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useAnalysis } from "@/components/AnalysisProvider";
import { useDashboardPace } from "@/components/DashboardPaceProvider";
import { useDateRange } from "@/components/DateRangeProvider";
import { streamChat } from "@/lib/api";
import type { ChatFilters, ChatRole, ChatTurn } from "@/types/chat";

const prompts = [
  "How has my pace changed over time?",
  "Does temperature affect my heart rate?",
  "How does sleep relate to my runs?",
];
const HISTORY_LIMIT = 20; // turns sent per request; matches the backend limit
const ASSISTANT_HISTORY_CHARS = 8000;

type Message = {
  id: number;
  role: ChatRole;
  content: string;
  state: "done" | "streaming" | "error";
  status?: string; // what the assistant is checking right now
};

export default function InsightsChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const nextId = useRef(0);
  const request = useRef<AbortController | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const helpId = useId();
  const { fromDate, toDate } = useDateRange();
  const { excludedRunIds } = useAnalysis();
  const { minPace, maxPace, minDistance, maxDistance, attributes, error: filterError } = useDashboardPace();
  const busy = messages.some((message) => message.state === "streaming");
  const period = !fromDate && !toDate ? "All time"
    : `${fromDate ? fromDate.slice(2) : "Beginning"} – ${toDate ? toDate.slice(2) : "Present"}`;
  const filterCount = [minPace ?? maxPace, minDistance ?? maxDistance, attributes.elevation || null, attributes.temperature || null]
    .filter((value) => value !== null).length + (excludedRunIds.length ? 1 : 0);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [messages]);

  useEffect(() => () => request.current?.abort(), []);

  function filters(): ChatFilters {
    // Invalid pace or distance text is ignored here; the filter bar already shows its error.
    const bounds = filterError ? {} : { minPace: minPace ?? undefined, maxPace: maxPace ?? undefined,
      minDistance: minDistance ?? undefined, maxDistance: maxDistance ?? undefined };
    return { start: fromDate || undefined, end: toDate || undefined, excludedRunIds, ...bounds,
      elevation: attributes.elevation || undefined, temperature: attributes.temperature || undefined };
  }

  function update(id: number, change: (message: Message) => Partial<Message>) {
    setMessages((current) => current.map((message) => message.id === id ? { ...message, ...change(message) } : message));
  }

  async function ask(history: Message[]) {
    const reply: Message = { id: nextId.current++, role: "assistant", content: "", state: "streaming", status: "Reading your question…" };
    setMessages([...history, reply]);
    setNotice("Runsight Assistant is answering.");
    const turns: ChatTurn[] = history.filter((message) => message.state === "done" && message.content)
      .slice(-HISTORY_LIMIT)
      .map(({ role, content }) => ({ role, content: role === "assistant" ? content.slice(0, ASSISTANT_HISTORY_CHARS) : content }));
    while (turns[0]?.role === "assistant") turns.shift();
    const controller = new AbortController();
    request.current = controller;
    let failed: string | null = null;
    try {
      await streamChat({ messages: turns, filters: filters() }, (event) => {
        if (event.type === "status") update(reply.id, () => ({ status: event.message }));
        else if (event.type === "delta") update(reply.id, (message) => ({ content: message.content + event.text, status: undefined }));
        else if (event.type === "error") failed = event.message;
      }, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        // Stopped by the user: keep any partial answer
        setMessages((current) => current.flatMap((message) => message.id !== reply.id ? [message]
          : message.content ? [{ ...message, state: "done" as const, status: undefined }] : []));
        setNotice("Answer stopped.");
        return;
      }
      failed = error instanceof Error && error.message !== "Failed to fetch" ? error.message
        : "Could not reach Runsight. Check your connection and try again.";
    } finally {
      if (request.current === controller) request.current = null;
    }
    if (failed) {
      update(reply.id, () => ({ state: "error", content: failed!, status: undefined }));
      setNotice(failed);
    } else {
      update(reply.id, () => ({ state: "done", status: undefined }));
      setNotice("Answer complete.");
    }
  }

  function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    setDraft("");
    inputRef.current?.focus();
    void ask([...messages.filter((message) => message.state !== "error"),
      { id: nextId.current++, role: "user", content, state: "done" }]);
  }

  function retry() {
    // Drop the failed reply and ask the last question again
    void ask(messages.filter((message) => message.state !== "error"));
  }

  return <div className="flex h-[600px] min-w-0 flex-col text-foreground">
    <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-selection text-brand">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true"><path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2v-10A8.5 8.5 0 0 1 10.5 3H13a7 7 0 0 1 7 7z" /><path d="M7 9h8M7 13h5" /></svg>
      </span>
      <div>
        <h2 className="text-base font-semibold">Runsight Assistant</h2>
        <p className="mt-1 text-xs text-muted">Ask about patterns in the runs you have selected.</p>
      </div>
    </header>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs">
      <p className="text-muted">Selected period: <span className="font-medium text-foreground">{period}</span>
        {filterCount > 0 && <> · <span className="font-medium text-foreground">{filterCount} filter{filterCount === 1 ? "" : "s"}</span></>}
      </p>
      <button type="button" disabled={!messages.length && !draft} onClick={() => {
        request.current?.abort();
        setMessages([]); setDraft(""); setNotice("Conversation cleared."); inputRef.current?.focus();
      }} className="cursor-pointer rounded px-2 py-1 font-medium text-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-50">Clear chat</button>
    </div>
    <div ref={conversationRef} role="log" aria-label="Chat conversation" aria-relevant="additions" aria-busy={busy} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
      <div className="max-w-[95%] rounded-xl rounded-tl-sm border border-border bg-surface px-4 py-3">
        <p className="mb-1 text-xs font-semibold text-brand">Runsight Assistant</p>
        <p className="text-sm leading-6">What would you like to learn about your runs?</p>
        <p className="mt-2 text-xs leading-5 text-muted">I look only at the runs in your selected period and filters, and I&apos;ll tell you how much evidence supports each pattern.</p>
      </div>
      {messages.map((message) => message.role === "user"
        ? <div key={message.id} className="ml-auto w-fit max-w-[90%] rounded-xl rounded-tr-sm bg-brand px-4 py-3 text-on-brand">
          <p className="mb-1 text-xs font-semibold">You</p>
          <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{message.content}</p>
        </div>
        : <div key={message.id} className={`max-w-[95%] rounded-xl rounded-tl-sm border px-4 py-3 ${message.state === "error" ? "border-negative/40 bg-surface" : "border-border bg-surface"}`}>
          <p className="mb-1 text-xs font-semibold text-brand">Runsight Assistant</p>
          {message.state === "error"
            ? <>
              <p className="text-sm leading-6 text-negative">{message.content}</p>
              <button type="button" onClick={retry} disabled={busy} className="mt-2 cursor-pointer rounded border border-control-border px-2 py-1 text-xs font-medium text-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-50">Try again</button>
            </>
            : <>
              {message.content && <AssistantText text={message.content} />}
              {message.status && <p className="flex items-center gap-2 text-xs text-muted">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand motion-reduce:animate-none" aria-hidden="true" />{message.status}
              </p>}
            </>}
        </div>)}
    </div>
    {!messages.length && <div className="shrink-0 px-4 pb-3">
      <p className="mb-2 text-[11px] font-medium text-muted">Start with a question</p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => <button key={prompt} type="button" onClick={() => { setDraft(prompt); inputRef.current?.focus(); }}
          className="cursor-pointer rounded-lg border border-control-border bg-surface px-3 py-2 text-left text-xs leading-4 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand">{prompt}</button>)}
      </div>
    </div>}
    <form onSubmit={sendMessage} className="shrink-0 border-t border-border bg-surface px-4 py-3">
      <label htmlFor={`${helpId}-input`} className="sr-only">Message Runsight Assistant</label>
      <div className="flex items-end gap-2 rounded-lg border border-control-border bg-surface-muted p-2 focus-within:outline-2 focus-within:outline-brand">
        <textarea ref={inputRef} id={`${helpId}-input`} value={draft} onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(); }
          }} rows={2} maxLength={2000} placeholder="Ask about your running…" aria-describedby={helpId}
          className="min-w-0 flex-1 resize-none bg-transparent px-1 py-1 text-sm leading-5 placeholder:text-muted focus:outline-none" />
        {busy
          ? <button type="button" onClick={() => request.current?.abort()} aria-label="Stop answer" title="Stop answer"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-brand text-on-brand hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
          </button>
          : <button type="submit" disabled={!draft.trim()} aria-label="Send message" title="Send message"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-brand text-on-brand hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-50">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7M12 5v14" /></svg>
          </button>}
      </div>
      <div id={helpId} className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[10px] text-muted">
        <span>Enter to send · Shift+Enter for a new line</span><span>{draft.length}/2,000</span>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted">AI answers can be wrong. Check patterns against the charts before acting on them.</p>
      <p role="status" className="sr-only">{notice}</p>
    </form>
  </div>;
}

// Renders the small formatting subset the assistant is asked to use: paragraphs, "- " bullets, and **bold**.
function AssistantText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return <div className="space-y-2 text-sm leading-6 [overflow-wrap:anywhere]">
    {blocks.map((block, index) => {
      const lines = block.split("\n").filter((line) => line.trim());
      if (lines.length && lines.every((line) => /^\s*[-*•]\s+/.test(line))) {
        return <ul key={index} className="list-disc space-y-1 pl-5">
          {lines.map((line, item) => <li key={item}>{inline(line.replace(/^\s*[-*•]\s+/, ""))}</li>)}
        </ul>;
      }
      return <p key={index} className="whitespace-pre-wrap">{inline(block)}</p>;
    })}
  </div>;
}

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") && part.length > 4
    ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
    : <Fragment key={index}>{part}</Fragment>);
}
