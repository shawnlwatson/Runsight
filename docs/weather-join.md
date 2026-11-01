# Location-based weather join: plan

Status: planned. No code has been written yet.

## Goal

Runsight's design requires weather to be correlated with each run and pulled from a location-based weather source (`docs/context.txt`, R3). The watch records temperature and humidity for only about half of runs, so the join fills in the rest from a historical weather source using each run's location and start time.

## Current state

- `pipeline/load_runs.py` maps `avg_temperature` (converted to °F) and `SESSION WEATHER HUMIDITY` (stored as % × 100, converted to %) from each FIT session. Runs without these fields get `null`.
- The loader's comment records that only about 48% of runs have watch weather.
- `data/derived/fit_inventory/weather_coverage_by_workout.csv` lists 454 workouts with `temperature_present` and `humidity_present` flags. Use it as the baseline for coverage.

## Inputs already in the data

| Input | Source | Notes |
|---|---|---|
| Start time (UTC) | `startTimeUtc` in MongoDB runs | Use the UTC timestamp for the historical lookup. |
| Local date | `date` in MongoDB runs | Already computed by the loader from the watch's wall clock. |
| Latitude and longitude | FIT `record.position_lat` and `record.position_long` | Stored as semicircles. Convert with degrees = semicircles × 180 / 2³¹. Field coverage is in `data/derived/fit_inventory/fields.csv`. |

Runs without GPS (for example, treadmill runs) cannot be joined by location. Report them as a separate, uncovered group.

## Proposed approach

1. **Extract location per run.** Take the first valid position in each FIT file's records, or the median of valid positions, and convert it to degrees. Store it with the run, not as a separate source of truth.
2. **Use Open-Meteo's historical archive** (`archive-api.open-meteo.com/v1/archive`) for hourly weather. It needs no API key and covers history back to 1940. Its free tier is for non-commercial use, capped at about 10,000 calls per day. Data is licensed CC BY 4.0, so the project must credit Open-Meteo. The values come from reanalysis models (ERA5 and related datasets) on a grid, not from weather stations, so they are modeled estimates at the run's location rather than measurements. Visual Crossing was considered and rejected because its free plan caps history records per day. Meteostat's terms were not verified.
3. **Fetch hourly weather at the run's location and start hour.** Use the hour nearest the start time, and record which hour was used.
4. **Write the join without overwriting watch data.** Watch-recorded values win for temperature and humidity, so they are never replaced. Fill the temperature and humidity gaps from Open-Meteo only where the watch value is missing, and store the source of each value so it can be audited.
5. **Add extra weather fields to every run that has GPS**, including runs where the watch already has weather, so every run has the same columns. Runs with no GPS keep these fields null and are reported as uncovered.

## Fields to add

Each field is the mean over the hours from the run's start to its end, using the same hourly variable names as the Open-Meteo archive. Units are as the API returns them.

| Field | Open-Meteo variable | Unit |
|---|---|---|
| Dew point | `dew_point_2m` | °F |
| Apparent temperature | `apparent_temperature` | °F |
| Precipitation | `precipitation` | mm |
| Rain | `rain` | mm |
| Snowfall | `snowfall` | cm |
| Weather code (WMO) | `weather_code` | code (mode over the run) |
| Sea-level pressure | `pressure_msl` | hPa |
| Cloud cover | `cloud_cover` | % |
| Wind speed | `wind_speed_10m` | km/h |
| Wind direction | `wind_direction_10m` | ° |
| Wind gusts | `wind_gusts_10m` | km/h |

Temperature and humidity are also pulled from Open-Meteo (`temperature_2m`, `relative_humidity_2m`) for gap-filling, and they are stored as `api_` fields next to the watch values. Stored values use the API's units, which are the same as the existing watch-derived fields, except wind speed and precipitation, which are metric. Convert these when displaying them, not when storing them.
5. **Make the join rerunnable.** Match the loader's upsert behavior so reruns don't duplicate data, and respect `pipeline/excluded_runs.json`.

## Validation

- Compare the watch and the historical source on runs where both exist. Report the difference in temperature and humidity.
- Report coverage before and after the join, by month, using the same method as `weather_coverage_by_workout.csv`.
- Unit-test the semicircle conversion and the nearest-hour selection, following the style of `pipeline/test_load_runs.py`.

## Open questions

- Whether Open-Meteo accepts several locations in one request, to reduce call volume for about 450 runs.
- Whether the non-commercial terms cover this project. Confirm with the team or instructor.
- Whether to store the source and the matched hour on each run document, or in a separate collection.
- Runs with no GPS stay null for every extra field. Report their count separately.
- How to handle runs that start in one location and end far from it.
- Whether the weather join belongs in the loader or in a separate script run after it.
