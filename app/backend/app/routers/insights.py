from datetime import date

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse

from app.models.chat import ChatRequest
from app.models.health import FatigueRun
from app.services.chat import AssistantUnavailable, gateway_token, make_client, stream_chat
from app.services.chat_tools import AnalysisScope
from app.services.runs import list_fatigue_runs

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/fatigue", response_model=list[FatigueRun])
def get_fatigue(start: date | None = None, end: date | None = None):
    return list_fatigue_runs(start, end)


@router.post("/chat")
def chat(request: ChatRequest, x_vercel_oidc_token: str | None = Header(default=None)):
    """Streams newline-delimited JSON events: status, delta (answer text), then done or error."""
    try:
        scope = AnalysisScope(request.filters)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    try:
        client = make_client(gateway_token(x_vercel_oidc_token))
    except AssistantUnavailable as error:
        raise HTTPException(status_code=503, detail="The assistant is not configured on this server.") from error
    return StreamingResponse(stream_chat(request, scope, client), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
