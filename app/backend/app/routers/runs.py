from datetime import date

from fastapi import APIRouter, HTTPException, Query

from app.models.run import Run
from app.models.summary import DashboardSummary
from app.services.runs import list_runs
from app.services.summary import add_distance_bounds, dashboard_summary, parse_attribute_filters

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=list[Run])
def get_runs(start: date | None = None, end: date | None = None):
    return list_runs(start, end)


@router.get("/summary", response_model=DashboardSummary)
def get_summary(start: date | None = None, end: date | None = None, exclude_id: list[str] | None = Query(default=None),
                min_pace: float | None = Query(default=None, gt=0, allow_inf_nan=False),
                max_pace: float | None = Query(default=None, gt=0, allow_inf_nan=False),
                distance: str | None = None, elevation: str | None = None, temperature: str | None = None,
                min_distance: float | None = Query(default=None, ge=0, allow_inf_nan=False),
                max_distance: float | None = Query(default=None, ge=0, allow_inf_nan=False)):
    if min_pace is not None and max_pace is not None and min_pace > max_pace:
        raise HTTPException(status_code=422, detail="min_pace must not exceed max_pace")
    if min_distance is not None and max_distance is not None and min_distance > max_distance:
        raise HTTPException(status_code=422, detail="min_distance must not exceed max_distance")
    try:
        attribute_filters = parse_attribute_filters(distance, elevation, temperature)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    add_distance_bounds(attribute_filters, min_distance, max_distance)
    return dashboard_summary(start, end, exclude_id, min_pace, max_pace, attribute_filters)
