"""Load every FIT run into MongoDB (runsight.runs), one document per run.

Top-level fields match the frontend's CurrentRun type (miles, min/mile, F, steps/min).
The raw FIT messages (session, laps, activity, sport, fileId) keep every field in original units.

Usage: python pipeline/load_runs.py
"""

import json
import math
import os
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

import fitdecode
from dotenv import load_dotenv
from pymongo import MongoClient, ReplaceOne

# Paths are resolved from this file, so the script works from any directory.
ROOT = Path(__file__).resolve().parent.parent
FIT_DIR = f"{ROOT}/data/raw/fit"
EXCLUSIONS_FILE = ROOT / "pipeline" / "excluded_runs.json"

# FIT message types stored in MongoDB
STORED_MESSAGES = {
    "session",  # whole-run summary: one per file
    "lap",      # per-lap summaries (splits)
    "activity", # holds local_timestamp, used for the local date
    "sport",    # sport / sub-sport
    "file_id",  # device and creation time
}

METERS_PER_MILE = 1609.344

# Open-Meteo historical archive (free, non-commercial, CC BY 4.0 attribution required).
# See docs/weather-join.md for the source decision and the reanalysis caveat.
OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"
API_TEMPERATURE = "temperature_2m"  # used only to fill runs with no watch temperature
API_HUMIDITY = "relative_humidity_2m"  # used only to fill runs with no watch humidity
# Extra Open-Meteo hourly variable -> stored field, in the API's units
WEATHER_FIELDS = {
    "dew_point_2m": "dewPointF",
    "apparent_temperature": "apparentTemperatureF",
    "precipitation": "precipitationMm",
    "rain": "rainMm",
    "snowfall": "snowfallCm",
    "weather_code": "weatherCode",  # WMO code: most common value over the run
    "pressure_msl": "pressureHpa",
    "cloud_cover": "cloudCoverPct",
    "wind_speed_10m": "windSpeedKmh",
    "wind_direction_10m": "windDirectionDeg",
    "wind_gusts_10m": "windGustsKmh",
}
HOURLY_VARIABLES = [API_TEMPERATURE, API_HUMIDITY, *WEATHER_FIELDS]
REQUEST_PAUSE_SECONDS = 0.2  # spaces out requests to stay well within the free tier
REQUEST_ATTEMPTS = 4  # retries transient network failures before the load stops


def clean(value):
    """Make a FIT value storable in MongoDB."""
    if isinstance(value, tuple):  # BSON has arrays, not tuples
        return list(value)
    if isinstance(value, float) and not math.isfinite(value):  # NaN/inf -> null
        return None
    return value


def read_messages(path):
    """Read one FIT file and return the KEEP messages as {field name: value} dicts."""
    messages = {"session": {}, "lap": [], "activity": {}, "sport": {}, "file_id": {}, "position": None}
    # Strict mode: a corrupt file raises an error instead of returning partial data
    with fitdecode.FitReader(
        path,
        check_crc=fitdecode.CrcCheck.RAISE,
        error_handling=fitdecode.ErrorHandling.RAISE,
    ) as fit:
        for frame in fit:
            # Frames include headers and field definitions. keep only data messages
            if not isinstance(frame, fitdecode.FitDataMessage):
                continue
            # First GPS point in the run, used for the weather lookup. Records themselves are not stored
            if frame.name == "record" and messages["position"] is None:
                lat = frame.get_value("position_lat", fallback=None)
                lon = frame.get_value("position_long", fallback=None)
                if lat is not None and lon is not None:
                    messages["position"] = (semicircles_to_degrees(lat), semicircles_to_degrees(lon))
            if frame.name in STORED_MESSAGES:
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


def semicircles_to_degrees(value):
    """FIT stores GPS as semicircles. 2**31 semicircles is 180 degrees."""
    return value * 180 / 2**31


_hourly_cache = {}


def fetch_hourly(lat, lon, first_day, last_day):
    """Open-Meteo hourly data in UTC for one point and date range. Cached so repeat points are free."""
    key = (lat, lon, first_day, last_day)
    if key not in _hourly_cache:
        query = urllib.parse.urlencode({
            "latitude": lat,
            "longitude": lon,
            "start_date": first_day,
            "end_date": last_day,
            "hourly": ",".join(HOURLY_VARIABLES),
            "temperature_unit": "fahrenheit",
            "timezone": "UTC",
        })
        for attempt in range(REQUEST_ATTEMPTS):
            try:
                with urllib.request.urlopen(f"{OPEN_METEO_URL}?{query}", timeout=60) as response:
                    _hourly_cache[key] = json.load(response)["hourly"]
                break
            except OSError:  # network errors and timeouts; a bad response still raises
                if attempt == REQUEST_ATTEMPTS - 1:
                    raise
                time.sleep(2 ** attempt)  # back off: 1 s, 2 s, ...
        time.sleep(REQUEST_PAUSE_SECONDS)
    return _hourly_cache[key]


def hourly_window(hour_times, start_utc, duration_seconds):
    """Indices of the hourly rows from the run's start hour through the hour it ends (UTC)."""
    start = start_utc.replace(tzinfo=None)
    first = start.replace(minute=0, second=0, microsecond=0)
    last = start + timedelta(seconds=duration_seconds or 0)
    return [i for i, t in enumerate(hour_times) if first <= datetime.fromisoformat(t) <= last]


def run_weather(hourly, start_utc, duration_seconds):
    """Average each hourly variable over the run. Returns None if no hour falls inside the run."""
    rows = hourly_window(hourly["time"], start_utc, duration_seconds)
    if not rows:
        return None

    def values(variable):
        return [hourly[variable][i] for i in rows if hourly[variable][i] is not None]

    def mean_of(variable):
        found = values(variable)
        return round(sum(found) / len(found), 2) if found else None

    result = {field: mean_of(variable) for variable, field in WEATHER_FIELDS.items()}
    code = values("weather_code")
    result["weatherCode"] = Counter(code).most_common(1)[0][0] if code else None
    result["apiTemperatureF"] = mean_of(API_TEMPERATURE)
    result["apiHumidityPct"] = mean_of(API_HUMIDITY)
    return result


def add_weather(doc, fetch=fetch_hourly):
    """Fill weather for one run document in place.

    The watch's temperature and humidity always win. Open-Meteo fills a gap only when the watch
    has no value. The extra fields are added to every run that has GPS, so all runs share columns.
    """
    doc["weather"] = None
    doc["apiTemperatureF"] = None
    doc["apiHumidityPct"] = None

    location = doc.get("location")
    if location is not None:
        start = doc["startTimeUtc"]
        duration = doc["totalTimeSeconds"] or 0
        # Round the point to the same precision the API uses, so nearby runs share one request
        hourly = fetch(
            round(location["lat"], 4),
            round(location["lon"], 4),
            start.date().isoformat(),
            (start + timedelta(seconds=duration)).date().isoformat(),
        )
        values = run_weather(hourly, start, duration)
        if values is not None:
            doc["apiTemperatureF"] = values.pop("apiTemperatureF")
            doc["apiHumidityPct"] = values.pop("apiHumidityPct")
            doc["weather"] = values

    # Watch values win. Fill gaps from Open-Meteo and record which source each value came from
    doc["temperatureSource"] = "watch" if doc.get("temperature") is not None else None
    if doc.get("temperature") is None and doc["apiTemperatureF"] is not None:
        doc["temperature"] = doc["apiTemperatureF"]
        doc["temperatureSource"] = "open-meteo"
    doc["humiditySource"] = "watch" if doc.get("humidity") is not None else None
    if doc.get("humidity") is None and doc["apiHumidityPct"] is not None:
        doc["humidity"] = doc["apiHumidityPct"]
        doc["humiditySource"] = "open-meteo"
    return doc


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
    indoor = session.get("SESSION INDOOR")  # Apple developer field (0/1). Missing = unknown
    run_id = path.stem[:17]  # "YYYY-MM-DD-HHMMSS" from the file name. unique and stable
    position = messages["position"]  # (lat, lon) in degrees, or None if the run has no GPS

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
        "isIndoor": indoor == 1 if indoor is not None else None,
        "location": {"lat": round(position[0], 6), "lon": round(position[1], 6)} if position else None,
        "sourceFile": path.name,  # traceability back to the raw file
        # --- Raw FIT messages, original units (m, s, m/s, C), for stats work ---
        "session": session,
        "laps": messages["lap"],
        "activity": activity,
        "sport": messages["sport"],
        "fileId": messages["file_id"],
    }


def main():
    # Explicitly excluded accidental recordings must not return on a later import.
    excluded_ids = {entry["id"] for entry in json.loads(EXCLUSIONS_FILE.read_text())}
    # Parse every file. a bad file is reported and skipped, not fatal
    docs = []
    for path in sorted(Path(FIT_DIR).glob("*.fit")):
        if path.stem[:17] in excluded_ids:
            print(f"Excluded accidental recording: {path.name}")
            continue
        try:
            docs.append(parse_run(path))
        except Exception as error:
            print(f"Skipped {path.name}: {error}")

    # bulk_write raises an error on an empty list
    if not docs:
        print("No runs to load")
        return

    # Look up weather before any write. A failed lookup stops the load, so existing documents
    # are never replaced with empty weather fields
    try:
        for doc in docs:
            add_weather(doc)
    except Exception as error:
        raise SystemExit(f"Weather lookup failed; nothing was written: {error}")

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
