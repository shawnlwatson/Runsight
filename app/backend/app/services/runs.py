from datetime import date

from app.db import health_collection, runs_collection

# Fields each endpoint returns (_id is always included)
RUN_FIELDS = [
    "date",
    "totalTimeSeconds",
    "totalCalories",
    "isIndoor",
    "averageCadenceSpm",
    "distanceMiles",
    "pace",
    "heartRate",
    "elevationFeet",
    "temperature",
    "sleepHours",
]
FATIGUE_FIELDS = ["date", "pace", "sleepHours", "activeEnergyKcal", "steps"]


def date_match(start: date | None, end: date | None):
    # Only filter by the dates that were given
    date_range = {}
    if start:
        date_range["$gte"] = start.isoformat()
    if end:
        date_range["$lte"] = end.isoformat()
    return {"$match": {"date": date_range} if date_range else {}}


def runs_with_health(start: date | None, end: date | None, fields: list[str]):
    pipeline = [
        date_match(start, end),
        {"$sort": {"date": 1, "_id": 1}},
        # Join each run to the daily_health document with the same date
        {
            "$lookup": {
                "from": health_collection.name,
                "localField": "date",
                "foreignField": "_id",
                "as": "health",
            }
        },
        # health is a list of 0 or 1 documents. No match leaves the field out (null)
        {
            "$set": {
                "sleepHours": {"$first": "$health.sleepHours"},
                "activeEnergyKcal": {"$first": "$health.activeEnergyKcal"},
                "steps": {"$first": "$health.steps"},
            }
        },
        {"$project": {field: 1 for field in fields}},
    ]
    return list(runs_collection.aggregate(pipeline))


def list_runs(start: date | None, end: date | None):
    return runs_with_health(start, end, RUN_FIELDS)


def list_fatigue_runs(start: date | None, end: date | None):
    return runs_with_health(start, end, FATIGUE_FIELDS)
