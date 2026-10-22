from datetime import date, timedelta

from app.db import runs_collection
from app.services.runs import date_match


def summarize(start: date | None, end: date | None):
    pipeline = [
        date_match(start, end),
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


def dashboard_summary(start: date | None, end: date | None):
    previous = None
    if start and end and start <= end:
        previous = summarize(*previous_period(start, end))
    return {"current": summarize(start, end), "previous": previous}
