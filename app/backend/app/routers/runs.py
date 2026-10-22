from datetime import date

from fastapi import APIRouter

from app.models.run import Run
from app.models.summary import DashboardSummary
from app.services.runs import list_runs
from app.services.summary import dashboard_summary

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=list[Run])
def get_runs(start: date | None = None, end: date | None = None):
    return list_runs(start, end)


@router.get("/summary", response_model=DashboardSummary)
def get_summary(start: date | None = None, end: date | None = None):
    return dashboard_summary(start, end)
