"""Unit tests for the weather join in load_runs.py. No network: the Open-Meteo fetch is replaced.

Run: python -m unittest -q pipeline/test_weather_join.py
"""

import unittest
from datetime import datetime, timezone

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


if __name__ == "__main__":
    unittest.main()
