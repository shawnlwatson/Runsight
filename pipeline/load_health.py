"""Load daily health data into MongoDB (runsight.daily_health), one document per date.

A Sleep row's date is the morning that sleep ended, so a run's prior-night sleep is the
document with the same date as the run. Durations are stored in hours.

Usage: python pipeline/load_health.py
"""

import argparse
import os
from datetime import date, datetime, time, timedelta
from pathlib import Path

import openpyxl
from dotenv import load_dotenv
from pymongo import MongoClient, ReplaceOne, UpdateOne

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
    # Headers have padding (" Steps ") and dots ("Avg. HRV"). Mongo reads dots as nested paths
    headers = [str(h).strip().replace(".", "") for h in next(rows)]
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start', type=date.fromisoformat, help='First date to load, inclusive')
    parser.add_argument('--end', type=date.fromisoformat, help='Last date to load, inclusive')
    parser.add_argument('--insert-only', action='store_true', help='Insert missing dates without replacing existing MongoDB records')
    parser.add_argument('--dry-run', action='store_true', help='Validate and count workbook dates without connecting to MongoDB')
    args = parser.parse_args()
    if args.start and args.end and args.start > args.end:
        parser.error('--start must not be after --end')
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
    workbook.close()

    # Build one document per date that appears in either sheet
    docs = []
    for day in sorted(daily.keys() | sleep.keys()):
        if (args.start and day < args.start.isoformat()) or (args.end and day > args.end.isoformat()):
            continue
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

    # bulk_write raises an error on an empty list
    if not docs:
        print("No dates to load")
        return
    if args.dry_run:
        print(f"Validated {len(docs)} dates ({docs[0]['date']} through {docs[-1]['date']}); no database writes")
        return

    # Connect to Mongo collection and upsert by date so re-running never duplicates
    load_dotenv(f"{ROOT}/.env")
    operations = [UpdateOne({"_id": d["_id"]}, {"$setOnInsert": d}, upsert=True)
                  if args.insert_only else ReplaceOne({"_id": d["_id"]}, d, upsert=True) for d in docs]
    with MongoClient(os.environ["MONGODB_URI"]) as client:
        result = client.runsight.daily_health.bulk_write(operations)
    print(
        f"Loaded {len(docs)} dates ({result.upserted_count} new, {result.modified_count} modified, {result.matched_count} existing matches)"
    )


if __name__ == "__main__":
    main()
