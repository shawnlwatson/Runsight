"""Load every FIT run into MongoDB (runsight.runs), one document per run.

Top-level fields match the frontend's CurrentRun type (miles, min/mile, F, steps/min).
The raw FIT messages (session, laps, activity, sport, fileId) keep every field in original units.

Usage: python pipeline/load_runs.py
"""

import math
import os
from pathlib import Path

import fitdecode
from dotenv import load_dotenv
from pymongo import MongoClient, ReplaceOne

# Paths are resolved from this file, so the script works from any directory.
ROOT = Path(__file__).resolve().parent.parent
FIT_DIR = f"{ROOT}/data/raw/fit"

# FIT message types stored in MongoDB
STORED_MESSAGES = {
    "session",  # whole-run summary: one per file
    "lap",      # per-lap summaries (splits)
    "activity", # holds local_timestamp, used for the local date
    "sport",    # sport / sub-sport
    "file_id",  # device and creation time
}

METERS_PER_MILE = 1609.344


def clean(value):
    """Make a FIT value storable in MongoDB."""
    if isinstance(value, tuple):  # BSON has arrays, not tuples
        return list(value)
    if isinstance(value, float) and not math.isfinite(value):  # NaN/inf -> null
        return None
    return value


def read_messages(path):
    """Read one FIT file and return the KEEP messages as {field name: value} dicts."""
    messages = {"session": {}, "lap": [], "activity": {}, "sport": {}, "file_id": {}}
    # Strict mode: a corrupt file raises an error instead of returning partial data
    with fitdecode.FitReader(
        path,
        check_crc=fitdecode.CrcCheck.RAISE,
        error_handling=fitdecode.ErrorHandling.RAISE,
    ) as fit:
        for frame in fit:
            # Frames include headers and field definitions. keep only data messages
            if isinstance(frame, fitdecode.FitDataMessage) and frame.name in STORED_MESSAGES:
                # FIT marks missing values as None. leave those fields out
                fields = {
                    f.name: clean(f.value) for f in frame.fields if f.value is not None
                }
                if frame.name == "lap":  # many laps per run, in order
                    messages["lap"].append(fields)
                else:  # one of each per file
                    messages[frame.name] = fields
    return messages


def times(value, factor):
    """Unit conversion that passes None through (missing stays missing)."""
    return value * factor if value is not None else None


def parse_run(path):
    """Build one run document. Missing values stay None."""
    messages = read_messages(path)
    session = messages["session"]
    activity = messages["activity"]

    # FIT times are UTC. local_timestamp is the watch's wall clock, so the difference is the time zone
    offset = activity["local_timestamp"].replace(tzinfo=None) - activity["timestamp"].replace(
        tzinfo=None
    )
    seconds = session.get("total_timer_time")  # moving time, excludes pauses
    miles = times(session.get("total_distance"), 1 / METERS_PER_MILE)  # convert meters -> miles
    cadence = session.get("avg_running_cadence")  # strides/min. 1 stride = 2 steps
    celsius = session.get("avg_temperature")  # only ~48% of runs have weather
    run_id = path.stem[:17]  # "YYYY-MM-DD-HHMMSS" from the file name. unique and stable

    return {
        # _id is MongoDB's primary key and id is the name the frontend uses
        "_id": run_id,
        # --- Frontend fields (CurrentRun in app/frontend/src/types/run.ts) ---
        "date": (session["start_time"] + offset).date().isoformat(),  # local calendar date
        "startTimeUtc": session["start_time"],
        "totalTimeSeconds": seconds,
        "distanceMiles": miles,
        "pace": seconds / 60 / miles if seconds and miles else None,  # min/mile
        "heartRate": session.get("avg_heart_rate"),  # bpm
        "totalCalories": session.get("total_calories"),  # kcal
        "averageCadenceSpm": (cadence + session.get("avg_fractional_cadence", 0)) * 2
        if cadence
        else None,  # strides/min -> steps/min
        "elevationFeet": times(session.get("total_ascent"), 3.28084),  # meters -> feet
        "temperature": celsius * 9 / 5 + 32 if celsius is not None else None,  # F
        "humidity": times(session.get("SESSION WEATHER HUMIDITY"), 1 / 100),  # stored as % x 100 (7900 -> 79%)
        "isIndoor": session.get("SESSION INDOOR") == 1,  # Apple developer field (0/1)
        "sourceFile": path.name,  # traceability back to the raw file
        # --- Raw FIT messages, original units (m, s, m/s, C), for stats work ---
        "session": session,
        "laps": messages["lap"],
        "activity": activity,
        "sport": messages["sport"],
        "fileId": messages["file_id"],
    }


def main():
    # Parse every file. a bad file is reported and skipped, not fatal
    docs = []
    for path in sorted(Path(FIT_DIR).glob("*.fit")):
        try:
            docs.append(parse_run(path))
        except Exception as error:
            print(f"Skipped {path.name}: {error}")

    # Connect to MongoDB collection
    load_dotenv(f"{ROOT}/.env")
    runs = MongoClient(os.environ["MONGODB_URI"]).runsight.runs

    # Upsert by _id: replace the run if it exists, insert it if not
    # Re-running the script never creates duplicates
    result = runs.bulk_write(
        [ReplaceOne({"_id": d["_id"]}, d, upsert=True) for d in docs]
    )
    runs.create_index("date")  # the frontend filters runs by date range

    print(
        f"Loaded {len(docs)} runs ({result.upserted_count} new, {result.matched_count} updated)"
    )


if __name__ == "__main__":
    main()
