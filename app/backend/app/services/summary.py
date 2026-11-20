from datetime import date, timedelta

from app.db import runs_collection
from app.services.runs import date_match


def parse_attribute_filters(distance: str | None, elevation: str | None, temperature: str | None):
    ranges = {
        "distanceMiles": {**{f"{n}–{n + 1}": {"$gte": n, "$lt": n + 1} for n in range(1, 10)}, "10+": {"$gte": 10}},
        "elevationFeet": {**{f"{n}–{n + 100}": {"$gte": n, "$lt": n + 100} for n in range(0, 500, 100)}, "500+": {"$gte": 500}},
        "temperature": {"<30": {"$lt": 30, "$ne": None}, **{f"{n}–{n + 10}": {"$gte": n, "$lt": n + 10} for n in range(30, 90, 10)}, "90+": {"$gte": 90}},
    }
    result = {}
    for field, selected in zip(ranges, [distance, elevation, temperature]):
        if not selected:
            continue
        if selected not in ranges[field]:
            raise ValueError(f"Invalid {field} filter")
        result[field] = ranges[field][selected]
    return result


def add_distance_bounds(attribute_filters: dict, min_distance: float | None, max_distance: float | None):
    """Merge inclusive numeric distance bounds into the bucket filters from parse_attribute_filters."""
    if min_distance is not None or max_distance is not None:
        bounds = attribute_filters.setdefault("distanceMiles", {})
        bounds["$ne"] = None
        if min_distance is not None:
            bounds["$gte"] = max(min_distance, bounds.get("$gte", min_distance))
        if max_distance is not None:
            bounds["$lte"] = max_distance
    return attribute_filters


def run_match(start: date | None, end: date | None, excluded_run_ids: list[str] | None = None,
              min_pace: float | None = None, max_pace: float | None = None,
              attribute_filters: dict | None = None):
    """$match stage for runs in a date range that pass the shared analysis filters."""
    match = date_match(start, end)
    match["$match"].update(attribute_filters or {})
    if excluded_run_ids:
        match["$match"]["_id"] = {"$nin": excluded_run_ids}
    if min_pace is not None or max_pace is not None:
        bounds = {"$gt": 0}
        if min_pace is not None:
            bounds["$gte"] = min_pace
        if max_pace is not None:
            bounds["$lte"] = max_pace
        match["$match"]["pace"] = bounds
    return match


def summarize(start: date | None, end: date | None, excluded_run_ids: list[str] | None = None,
              min_pace: float | None = None, max_pace: float | None = None,
              attribute_filters: dict | None = None):
    match = run_match(start, end, excluded_run_ids, min_pace, max_pace, attribute_filters)
    pipeline = [
        match,
        # Collapse every matched run into one document. $sum and $avg skip nulls
        {
            "$group": {
                "_id": None,
                "totalRuns": {"$sum": 1},
                "totalDistanceMiles": {"$sum": "$distanceMiles"},
                "avgHeartRate": {"$avg": "$heartRate"},
                # Pace only uses runs that have a pace (time and distance both known)
                "paceSeconds": {"$sum": {"$cond": [{"$gt": ["$pace", None]}, "$totalTimeSeconds", 0]}},
                "paceMiles": {"$sum": {"$cond": [{"$gt": ["$pace", None]}, "$distanceMiles", 0]}},
            }
        },
    ]
    result = next(runs_collection.aggregate(pipeline), None)

    # No runs in the range
    if result is None:
        return {"totalRuns": 0, "totalDistanceMiles": 0, "avgPace": None, "avgHeartRate": None}

    # Overall pace = total time / total distance, so longer runs count more
    miles = result["paceMiles"]
    result["avgPace"] = result["paceSeconds"] / 60 / miles if miles else None
    return result


def previous_period(start: date, end: date):
    # Same number of days, ending the day before start
    length = end - start + timedelta(days=1)
    return start - length, start - timedelta(days=1)


def dashboard_summary(start: date | None, end: date | None, excluded_run_ids: list[str] | None = None,
                      min_pace: float | None = None, max_pace: float | None = None,
                      attribute_filters: dict | None = None):
    previous = None
    if start and end and start <= end:
        previous = summarize(*previous_period(start, end), excluded_run_ids=excluded_run_ids,
                             min_pace=min_pace, max_pace=max_pace, attribute_filters=attribute_filters)
    return {"current": summarize(start, end, excluded_run_ids, min_pace, max_pace, attribute_filters), "previous": previous}
