"""Load daily health data into MongoDB (runsight.daily_health), one document per date.

A Sleep row's date is the morning that sleep ended, so a run's prior-night sleep is the
document with the same date as the run. Durations are stored in hours.

Usage: python pipeline/load_health.py
"""

import os
from datetime import datetime, time, timedelta
from pathlib import Path

import openpyxl
from dotenv import load_dotenv
from pymongo import MongoClient, ReplaceOne

# Paths are resolved from this file, so the script works from any directory
ROOT = Path(__file__).resolve().parent.parent

# The synthetic workbook is used because it covers all necessary vals
WORKBOOK = f"{ROOT}/data/synthetic/results/Health Metrics_synthetic.xlsx"


def clean(value):
    """Make a workbook cell storable in MongoDB: blank -> None, duration -> hours, clock time -> text."""
    if value == "":
        return None
    if isinstance(value, timedelta):  # e.g. Asleep 7:52:47 -> 7.88
        return value.total_seconds() / 3600
    if isinstance(value, time):  # e.g. sleep Start 23:14:44. BSON has no time-only type
        return value.isoformat()
    return value


def read_sheet(workbook, name):
    """{"YYYY-MM-DD": {column: value}} with one row per date."""
    rows = workbook[name].iter_rows(values_only=True)
    headers = [str(h).strip() for h in next(rows)]  # headers have padding: " Steps "
    by_date = {}

    for row in rows:
        if isinstance(row[0], datetime):  # column A is the date; skip blank rows
            # Skip unnamed trailing columns (header None -> "None")
            values = {h: clean(v) for h, v in zip(headers[1:], row[1:]) if h != "None"}
            # Leave out empty cells rather than storing nulls
            by_date[row[0].date().isoformat()] = {
                h: v for h, v in values.items() if v is not None
            }
            
    return by_date


def main():
    # Read the two sheets the frontend needs
    workbook = openpyxl.load_workbook(WORKBOOK, read_only=True)
    daily = read_sheet(workbook, "Daily Metrics")
    sleep = read_sheet(workbook, "Sleep")
    # The generator labels each sheet/date as "measured" or "synthetic_model"
    # Rows are (sheet, date, label, counts...); [1:] skips the header row
    provenance = {
        (sheet, day): label
        for sheet, day, label, *_ in list(
            workbook["Record Provenance"].iter_rows(values_only=True)
        )[1:]
    }

    # Build one document per date that appears in either sheet
    docs = []
    for day in sorted(daily.keys() | sleep.keys()):
        d, s = daily.get(day), sleep.get(day)
        docs.append(
            {
                "_id": day,  # the date is the primary key and the join key for runs
                "date": day,
                # The three fields the frontend reads (FatigueRun / CurrentRun)
                "sleepHours": s.get("Asleep") if s else None,
                "activeEnergyKcal": d.get("Active Energy") if d else None,
                "steps": d.get("Steps") if d else None,
                "dailyMetrics": d,  # every Daily Metrics column
                "sleep": s,  # every Sleep column
                # Lets the UI flag synthetic values
                "provenance": {
                    "dailyMetrics": provenance.get(("Daily Metrics", day)),
                    "sleep": provenance.get(("Sleep", day)),
                },
            }
        )

    # Connect to Mongo collection and upsert by date so re-running never duplicates
    load_dotenv(f"{ROOT}/.env")
    health = MongoClient(os.environ["MONGODB_URI"]).runsight.daily_health
    result = health.bulk_write(
        [ReplaceOne({"_id": d["_id"]}, d, upsert=True) for d in docs]
    )
    print(
        f"Loaded {len(docs)} dates ({result.upserted_count} new, {result.matched_count} updated)"
    )


if __name__ == "__main__":
    main()
