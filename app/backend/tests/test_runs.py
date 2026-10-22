"""Endpoint tests for the Runsight API.

MongoDB is replaced by mongomock (an in-memory fake), so the tests run offline, never touch
the real database, and use a small hand-built dataset whose expected numbers are easy to check.

Usage (from app/backend): ../../.venv/bin/python -m unittest tests/test_runs.py
"""

import os
import unittest
from unittest.mock import patch

import mongomock
from fastapi.testclient import TestClient

# app.db connects when it is imported, so swap in the fake client before importing the app.
# The placeholder URI is only used when no .env exists; mongomock never connects to it.
os.environ.setdefault("MONGODB_URI", "mongodb://localhost")
with patch("pymongo.MongoClient", mongomock.MongoClient):
    from app.db import health_collection, runs_collection
    from app.main import app

# Field sets from the frontend types (app/frontend/src/types)
CURRENT_RUN_FIELDS = {
    "id", "date", "totalTimeSeconds", "totalCalories", "isIndoor", "averageCadenceSpm",
    "distanceMiles", "pace", "heartRate", "elevationFeet", "temperature", "sleepHours",
}
FATIGUE_RUN_FIELDS = {"id", "date", "pace", "sleepHours", "activeEnergyKcal", "steps"}


def make_run(run_id, date, seconds, miles, heart_rate, **overrides):
    """A run document shaped like load_runs.py output, including raw FIT data the API must hide."""
    run = {
        "_id": run_id,
        "date": date,
        "totalTimeSeconds": seconds,
        "totalCalories": 300.0,
        "isIndoor": False,
        "averageCadenceSpm": 170.0,
        "distanceMiles": miles,
        "pace": seconds / 60 / miles if seconds and miles else None,
        "heartRate": heart_rate,
        "elevationFeet": 50.0,
        "temperature": 70.0,
        "sourceFile": f"{run_id}.fit",
        "session": {"total_distance": 1000},  # raw FIT blobs
        "laps": [{"total_distance": 1000}],
    }
    run.update(overrides)
    return run


# Previous period for Sept 1-10 is Aug 22-31 (same 10 days, right before)
RUNS = [
    make_run("2026-08-25-070000", "2026-08-25", 2400, 4.0, 140.0),  # 10:00 /mi
    make_run("2026-09-01-070000", "2026-09-01", 1800, 3.0, 150.0),  # 10:00 /mi
    make_run("2026-09-05-070000", "2026-09-05", 3240, 6.0, 160.0),  # 9:00 /mi
    # No distance, heart rate, or indoor flag, and no health row for this date
    make_run("2026-09-10-070000", "2026-09-10", 600, None, None, isIndoor=None, temperature=None),
]
HEALTH = [
    {"_id": "2026-08-25", "date": "2026-08-25", "sleepHours": 6.5, "activeEnergyKcal": 500.0, "steps": 8000},
    {"_id": "2026-09-01", "date": "2026-09-01", "sleepHours": 7.5, "activeEnergyKcal": 600.0, "steps": 9000},
    {"_id": "2026-09-05", "date": "2026-09-05", "sleepHours": 8.0, "activeEnergyKcal": 0.0, "steps": 0},
]


class ApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # The endpoints only read, so one load serves every test
        runs_collection.delete_many({})
        health_collection.delete_many({})
        runs_collection.insert_many([dict(run) for run in RUNS])
        health_collection.insert_many([dict(day) for day in HEALTH])
        cls.client = TestClient(app)

    def get_json(self, path):
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()


class RunsTests(ApiTestCase):
    def test_returns_every_run_sorted_by_date(self):
        runs = self.get_json("/runs")
        self.assertEqual([r["date"] for r in runs], ["2026-08-25", "2026-09-01", "2026-09-05", "2026-09-10"])

    def test_fields_match_current_run_type(self):
        # Exactly the CurrentRun fields: _id renamed to id, raw FIT data left out
        for run in self.get_json("/runs"):
            self.assertEqual(set(run), CURRENT_RUN_FIELDS)
        self.assertEqual(self.get_json("/runs")[0]["id"], "2026-08-25-070000")

    def test_joins_sleep_by_date(self):
        runs = {r["date"]: r for r in self.get_json("/runs")}
        self.assertEqual(runs["2026-09-01"]["sleepHours"], 7.5)
        self.assertIsNone(runs["2026-09-10"]["sleepHours"])  # no health row that day

    def test_missing_values_are_null(self):
        run = self.get_json("/runs")[-1]
        for field in ["distanceMiles", "pace", "heartRate", "isIndoor", "temperature"]:
            self.assertIsNone(run[field], field)

    def test_date_range_is_inclusive(self):
        runs = self.get_json("/runs?start=2026-09-01&end=2026-09-05")
        self.assertEqual([r["date"] for r in runs], ["2026-09-01", "2026-09-05"])

    def test_one_sided_date_ranges(self):
        self.assertEqual(len(self.get_json("/runs?start=2026-09-05")), 2)
        self.assertEqual(len(self.get_json("/runs?end=2026-09-01")), 2)

    def test_range_with_no_runs_is_empty(self):
        self.assertEqual(self.get_json("/runs?start=2030-01-01"), [])

    def test_invalid_date_is_rejected(self):
        self.assertEqual(self.client.get("/runs?start=not-a-date").status_code, 422)


class FatigueTests(ApiTestCase):
    def test_fields_match_fatigue_run_type(self):
        for run in self.get_json("/insights/fatigue"):
            self.assertEqual(set(run), FATIGUE_RUN_FIELDS)

    def test_joins_daily_health(self):
        runs = {r["date"]: r for r in self.get_json("/insights/fatigue")}
        self.assertEqual(runs["2026-09-01"]["activeEnergyKcal"], 600.0)
        self.assertEqual(runs["2026-09-01"]["steps"], 9000)
        # Zero is a real value, not missing
        self.assertEqual(runs["2026-09-05"]["steps"], 0)
        self.assertEqual(runs["2026-09-05"]["activeEnergyKcal"], 0)

    def test_no_health_row_is_null(self):
        run = self.get_json("/insights/fatigue?start=2026-09-10")[0]
        self.assertIsNone(run["sleepHours"])
        self.assertIsNone(run["activeEnergyKcal"])
        self.assertIsNone(run["steps"])


class SummaryTests(ApiTestCase):
    def test_current_period_totals(self):
        current = self.get_json("/runs/summary?start=2026-09-01&end=2026-09-10")["current"]
        self.assertEqual(current["totalRuns"], 3)
        self.assertAlmostEqual(current["totalDistanceMiles"], 9.0)  # 3 + 6; null distance skipped
        # Pace = total time / total distance over runs that have a pace:
        # (1800 + 3240) s / 60 / (3 + 6) mi = 9.33 min/mi. The 600 s run has no distance, so it is left out
        self.assertAlmostEqual(current["avgPace"], 84 / 9)
        self.assertAlmostEqual(current["avgHeartRate"], 155.0)  # (150 + 160) / 2; null skipped

    def test_previous_period_is_same_length_before(self):
        previous = self.get_json("/runs/summary?start=2026-09-01&end=2026-09-10")["previous"]
        self.assertEqual(previous["totalRuns"], 1)  # only the Aug 25 run
        self.assertAlmostEqual(previous["totalDistanceMiles"], 4.0)
        self.assertAlmostEqual(previous["avgPace"], 10.0)
        self.assertAlmostEqual(previous["avgHeartRate"], 140.0)

    def test_no_previous_period_without_both_dates(self):
        self.assertIsNone(self.get_json("/runs/summary")["previous"])
        self.assertIsNone(self.get_json("/runs/summary?start=2026-09-01")["previous"])

    def test_all_time_summary(self):
        self.assertEqual(self.get_json("/runs/summary")["current"]["totalRuns"], 4)

    def test_empty_period(self):
        current = self.get_json("/runs/summary?start=2030-01-01&end=2030-01-31")["current"]
        self.assertEqual(current["totalRuns"], 0)
        self.assertEqual(current["totalDistanceMiles"], 0)
        self.assertIsNone(current["avgPace"])
        self.assertIsNone(current["avgHeartRate"])


class StatusTests(ApiTestCase):
    def test_healthz(self):
        self.get_json("/healthz")


if __name__ == "__main__":
    unittest.main()
