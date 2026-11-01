"""Unit tests for the weather join in load_runs.py. No network: the Open-Meteo fetch is replaced.

Run: python -m unittest -q pipeline/test_weather_join.py
"""

import io
import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import load_runs


def fake_hourly(hours):
    """Build an Open-Meteo style hourly payload. `hours` maps each variable to one value per row."""
    return {
        "time": ["2026-10-21T10:00", "2026-10-21T11:00", "2026-10-21T12:00"],
        load_runs.API_TEMPERATURE: hours.get("temp", [50.0, 60.0, 70.0]),
        load_runs.API_HUMIDITY: hours.get("hum", [80, 70, 60]),
        "dew_point_2m": [40.0, 45.0, 50.0],
        "apparent_temperature": [48.0, 58.0, 68.0],
        "precipitation": [0.0, 0.0, 0.0],
        "rain": [0.0, 0.0, 0.0],
        "snowfall": [0.0, 0.0, 0.0],
        "weather_code": [0, 3, 3],
        "pressure_msl": [1000.0, 1002.0, 1004.0],
        "cloud_cover": [10, 20, 30],
        "wind_speed_10m": [5.0, 7.0, 9.0],
        "wind_direction_10m": [90, 180, 270],
        "wind_gusts_10m": [8.0, 10.0, 12.0],
    }


def make_doc(temperature=None, humidity=None, lat=30.5, lon=-96.3, duration=5400):
    """A minimal run document as parse_run() returns it, before weather is added."""
    return {
        "startTimeUtc": datetime(2026, 10, 21, 10, 30, tzinfo=timezone.utc),
        "totalTimeSeconds": duration,
        "temperature": temperature,
        "humidity": humidity,
        "location": None if lat is None else {"lat": lat, "lon": lon},
    }


class SemicirclesTest(unittest.TestCase):
    def test_half_circle_is_ninety_degrees(self):
        self.assertAlmostEqual(load_runs.semicircles_to_degrees(2**30), 90.0)

    def test_negative_longitude(self):
        self.assertAlmostEqual(load_runs.semicircles_to_degrees(-(2**30)), -90.0)


class HourlyWindowTest(unittest.TestCase):
    def test_includes_start_hour_and_hour_the_run_ends_in(self):
        times = ["2026-10-21T10:00", "2026-10-21T11:00", "2026-10-21T12:00", "2026-10-21T13:00"]
        start = datetime(2026, 10, 21, 10, 30, tzinfo=timezone.utc)
        # 10:30 + 90 min ends at 12:00, so the 12:00 hour is included and 13:00 is not
        self.assertEqual(load_runs.hourly_window(times, start, 5400), [0, 1, 2])

    def test_short_run_uses_only_its_start_hour(self):
        times = ["2026-10-21T10:00", "2026-10-21T11:00"]
        start = datetime(2026, 10, 21, 10, 5, tzinfo=timezone.utc)
        self.assertEqual(load_runs.hourly_window(times, start, 600), [0])


class RunWeatherTest(unittest.TestCase):
    def test_averages_hours_and_takes_most_common_code(self):
        start = datetime(2026, 10, 21, 10, 30, tzinfo=timezone.utc)
        result = load_runs.run_weather(fake_hourly({}), start, 5400)
        self.assertAlmostEqual(result["apiTemperatureF"], 60.0)  # mean of 50, 60, 70
        self.assertAlmostEqual(result["apiHumidityPct"], 70.0)  # mean of 80, 70, 60
        self.assertEqual(result["weatherCode"], 3)  # most common of 0, 3, 3
        self.assertAlmostEqual(result["windSpeedKmh"], 7.0)

    def test_no_hours_inside_run_returns_none(self):
        start = datetime(2026, 10, 21, 15, 0, tzinfo=timezone.utc)
        self.assertIsNone(load_runs.run_weather(fake_hourly({}), start, 600))


class AddWeatherTest(unittest.TestCase):
    def fetch(self, *args):
        self.calls.append(args)
        return fake_hourly({})

    def setUp(self):
        self.calls = []

    def test_watch_values_are_never_replaced(self):
        doc = load_runs.add_weather(make_doc(temperature=55.0, humidity=90.0), fetch=self.fetch)
        self.assertEqual(doc["temperature"], 55.0)
        self.assertEqual(doc["temperatureSource"], "watch")
        self.assertEqual(doc["humidity"], 90.0)
        self.assertEqual(doc["humiditySource"], "watch")
        # Open-Meteo values are still recorded for comparison
        self.assertAlmostEqual(doc["apiTemperatureF"], 60.0)

    def test_gaps_are_filled_from_open_meteo(self):
        doc = load_runs.add_weather(make_doc(temperature=None, humidity=None), fetch=self.fetch)
        self.assertAlmostEqual(doc["temperature"], 60.0)
        self.assertEqual(doc["temperatureSource"], "open-meteo")
        self.assertAlmostEqual(doc["humidity"], 70.0)
        self.assertEqual(doc["humiditySource"], "open-meteo")

    def test_run_without_gps_stays_null_and_makes_no_request(self):
        doc = load_runs.add_weather(make_doc(temperature=None, humidity=None, lat=None), fetch=self.fetch)
        self.assertEqual(self.calls, [])
        self.assertIsNone(doc["weather"])
        self.assertIsNone(doc["apiTemperatureF"])
        self.assertIsNone(doc["temperature"])
        self.assertIsNone(doc["temperatureSource"])

    def test_every_run_with_gps_gets_extra_fields(self):
        doc = load_runs.add_weather(make_doc(temperature=55.0, humidity=90.0), fetch=self.fetch)
        self.assertEqual(set(doc["weather"]), set(load_runs.WEATHER_FIELDS.values()))

    def test_request_uses_rounded_point_and_run_dates(self):
        load_runs.add_weather(make_doc(lat=30.561723, lon=-96.280488), fetch=self.fetch)
        self.assertEqual(self.calls, [(30.5617, -96.2805, "2026-10-21", "2026-10-21")])


class HourBoundaryTest(unittest.TestCase):
    times = ["2026-10-21T10:00", "2026-10-21T11:00", "2026-10-21T12:00"]

    def test_run_starting_exactly_on_the_hour_starts_with_that_hour(self):
        start = datetime(2026, 10, 21, 10, 0, tzinfo=timezone.utc)
        self.assertEqual(load_runs.hourly_window(self.times, start, 3600), [0, 1])

    def test_run_ending_exactly_on_the_hour_includes_that_hour(self):
        start = datetime(2026, 10, 21, 10, 30, tzinfo=timezone.utc)
        self.assertEqual(load_runs.hourly_window(self.times, start, 5400), [0, 1, 2])


class MidnightCrossingTest(unittest.TestCase):
    def test_request_spans_both_dates_when_run_crosses_midnight_utc(self):
        calls = []

        def fetch(*args):
            calls.append(args)
            return fake_hourly({})

        doc = make_doc(lat=30.5, lon=-96.3, duration=5400)
        doc["startTimeUtc"] = datetime(2026, 10, 21, 23, 30, tzinfo=timezone.utc)
        load_runs.add_weather(doc, fetch=fetch)
        self.assertEqual(calls, [(30.5, -96.3, "2026-10-21", "2026-10-22")])


class NoHoursInWindowTest(unittest.TestCase):
    def test_run_outside_returned_hours_keeps_watch_values_and_nulls_the_rest(self):
        doc = make_doc(temperature=55.0, humidity=None)
        doc["startTimeUtc"] = datetime(2026, 10, 21, 20, 0, tzinfo=timezone.utc)  # no row at 20:00
        load_runs.add_weather(doc, fetch=lambda *args: fake_hourly({}))
        self.assertIsNone(doc["weather"])
        self.assertIsNone(doc["apiTemperatureF"])
        self.assertEqual(doc["temperature"], 55.0)
        self.assertEqual(doc["temperatureSource"], "watch")
        self.assertIsNone(doc["humidity"])
        self.assertIsNone(doc["humiditySource"])


class FetchRetryTest(unittest.TestCase):
    def setUp(self):
        load_runs._hourly_cache.clear()
        self.payload = json.dumps({"hourly": fake_hourly({})}).encode()

    def test_retries_network_errors_then_succeeds(self):
        responses = [OSError("timeout"), OSError("timeout"), io.BytesIO(self.payload)]
        with patch("load_runs.urllib.request.urlopen", side_effect=responses) as urlopen, \
             patch("load_runs.time.sleep"):
            result = load_runs.fetch_hourly(30.5, -96.3, "2026-10-21", "2026-10-21")
        self.assertEqual(urlopen.call_count, 3)
        self.assertEqual(result["time"][0], "2026-10-21T10:00")

    def test_gives_up_after_all_attempts(self):
        with patch("load_runs.urllib.request.urlopen", side_effect=OSError("down")) as urlopen, \
             patch("load_runs.time.sleep"):
            with self.assertRaises(OSError):
                load_runs.fetch_hourly(30.5, -96.3, "2026-10-21", "2026-10-21")
        self.assertEqual(urlopen.call_count, load_runs.REQUEST_ATTEMPTS)

    def test_repeat_point_and_dates_is_fetched_once(self):
        with patch("load_runs.urllib.request.urlopen", side_effect=[io.BytesIO(self.payload)]) as urlopen, \
             patch("load_runs.time.sleep"):
            load_runs.fetch_hourly(30.5, -96.3, "2026-10-21", "2026-10-21")
            load_runs.fetch_hourly(30.5, -96.3, "2026-10-21", "2026-10-21")
        self.assertEqual(urlopen.call_count, 1)


class FailedLookupWritesNothingTest(unittest.TestCase):
    def test_main_stops_before_writing_when_weather_lookup_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            fit_dir = Path(folder) / "fit"
            fit_dir.mkdir()
            (fit_dir / "2026-10-21-103000-test.fit").write_bytes(b"")
            exclusions = Path(folder) / "excluded.json"
            exclusions.write_text("[]")
            doc = make_doc(lat=30.5, lon=-96.3)
            doc["_id"] = "2026-10-21-103000"
            client = MagicMock()
            collection = client.runsight.runs
            load_runs._hourly_cache.clear()
            with patch.object(load_runs, "FIT_DIR", str(fit_dir)), \
                 patch.object(load_runs, "EXCLUSIONS_FILE", exclusions), \
                 patch.object(load_runs, "parse_run", return_value=doc), \
                 patch.object(load_runs, "load_dotenv"), \
                 patch.object(load_runs, "MongoClient", return_value=client), \
                 patch.dict("os.environ", {"MONGODB_URI": "mongodb://localhost"}), \
                 patch("load_runs.urllib.request.urlopen", side_effect=OSError("down")), \
                 patch("load_runs.time.sleep"):
                with self.assertRaises(SystemExit) as raised:
                    load_runs.main()
        self.assertIn("nothing was written", str(raised.exception))
        collection.bulk_write.assert_not_called()


if __name__ == "__main__":
    unittest.main()
