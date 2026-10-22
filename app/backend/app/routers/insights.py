from datetime import date

from fastapi import APIRouter

from app.models.health import FatigueRun
from app.services.runs import list_fatigue_runs

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/fatigue", response_model=list[FatigueRun])
def get_fatigue(start: date | None = None, end: date | None = None):
    return list_fatigue_runs(start, end)
