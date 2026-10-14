# FIT inventory

Run from any directory using the environment already installed here:

```bash
/home/shawn/Runsight/data/.venv/bin/python /home/shawn/Runsight/data/fit_inventory.py
```

By default this recursively reads Runsight/data/raw/.FIT Files (including hidden directories) and writes Runsight/data/fit_inventory_results. Only files whose extension is .fit, case-insensitively, are read. Windows Zone.Identifier sidecars are excluded. Original FIT files are never changed.

To choose another input/output directory or sample a subset:

```bash
/home/shawn/Runsight/data/.venv/bin/python /home/shawn/Runsight/data/fit_inventory.py "/path/to/workouts" --output "/path/to/reports"
/home/shawn/Runsight/data/.venv/bin/python /home/shawn/Runsight/data/fit_inventory.py --limit 10 --output /tmp/fit-sample
```

For a new environment, run from `Runsight/data`:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-fit.txt
.venv/bin/python fit_inventory.py
```

## Reports

- **summary.json**: valid/failed file counts, UTC earliest/latest workout starts, parser version, and counting policies.
- **files.csv**: every input file, validity/error/warnings, session count, workout date and its source, and first/last record timestamp.
- **failed_files.csv**: only failed files; parse/CRC error is included. Partial data from failures does not enter coverage totals.
- **messages.csv**: every encountered data message type, total instances, and counts of files/workouts containing it.
- **fields.csv**: every decoded field identity, including unknown and developer fields. Lists message level, field number/name, developer index, expanded status, units, types, occurrence counts, file counts, workout counts, and coverage percentage.
- **workout_fields.csv**: file-to-field mapping with occurrence and non-null occurrence counts. Supports examining which workouts contain or lack a particular field. Contains valid files only, including valid non-workout files if scanned; files.csv identifies these.
- **metric_coverage.csv**: requested metric groups and extra running metrics, with counts and percentages at any level and separately at session, lap, record, weather, and other timestamped levels. Matched field names are explicit; absent metrics still get zero rows.
- **inventory.json**: summary, files, messages, fields, and metric coverage in one JSON document. workout_fields.csv holds the detailed file-to-field mapping.

## Counting and interpretation

A workout is one successfully parsed FIT activity file. The script recognizes a workout from session/record messages or an activity file type. Each workout contributes at most one count per field or metric per level, regardless of sample/lap count. Multi-session files are flagged in summary.json and count once. Every file in this Runsight scan contained exactly one session.

`workouts_present` counts files containing the decoded field, even if every value is invalid/missing. `workouts_with_values` counts files with at least one usable value. `coverage_pct` uses the latter divided by all valid workout files. Arrays need at least one usable member. Null, empty, and nonfinite values do not count; zero and False do. Coverage describes availability of values, not plausibility or sensor quality.

The complete inventory includes metadata fields (for example field_description.field_name) but metric coverage excludes metadata declarations. Merely declaring a developer field does not establish measured coverage. All decoded fields are inventoried; unused message/field definitions are not data coverage. Decoder-generated expansion fields (such as altitude expanded from enhanced_altitude) are marked is_expanded and do not increase workout counts.

Metric grouping uses documented field-name patterns in summary.json and fit_inventory.py. It reports native fields and developer fields, with the actual matches in each row. Unknown numeric fields remain in the full inventory but cannot be assigned a meaning from their name. GPS grouping includes coordinates, session bounds, and accuracy; consult record.position_lat and record.position_long individually to verify coordinate availability. Stride length grouping includes FIT step_length, and preserves that name and its units; no stride/step conversion is applied. Humidity's developer field in these files provides no units. No weather or running metrics are inferred from other measurements.

Workout starts use UTC session.start_time, falling back to first record timestamp, activity end timestamp, then file creation timestamp. Date source is included per file; all current files used session.start_time. local_timestamp is not used as a UTC timestamp. The reader enforces CRC and parser errors; files with those failures are excluded from aggregate coverage.

## Current scan

446 valid workouts, 0 failures, 0 parser warnings. Starts range from 2021-01-04T14:33:15+00:00 to 2026-09-30T11:08:56+00:00. Inventory includes 12 message types and 143 decoded field identities (including expansions), across 1,004,111 record messages.

| Metric | Any level | Session/activity | Lap | Timestamped record |
| --- | ---: | ---: | ---: | ---: |
| Temperature | 210 | 210 | 0 | 0 |
| Humidity | 210 | 210 | 0 | 0 |
| Wind speed | 0 | 0 | 0 | 0 |
| Wind direction | 0 | 0 | 0 | 0 |
| Weather conditions | 0 | 0 | 0 | 0 |
| GPS | 445 | 445 | 0 | 445 |
| Elevation | 445 | 445 | 0 | 445 |
| Heart rate | 442 | 442 | 440 | 441 |
| Cadence | 444 | 444 | 442 | 444 |
| Power | 307 | 305 | 304 | 307 |
| Ground contact time | 302 | 302 | 302 | 302 |
| Vertical oscillation | 302 | 302 | 302 | 302 |
| Stride/step length | 302 | 302 | 302 | 302 |

These are workout counts with usable values, out of 446. Full outputs also include vertical ratio, ground contact balance, speed, distance, and respiration rate.

## Verification

```bash
cd /home/shawn/Runsight/data
.venv/bin/python -m unittest -q test_fit_inventory
```

Tests build small binary FIT files to verify repeated records count once per workout, null versus zero values, session and lap versus record coverage, case-insensitive and hidden-directory discovery, sidecar exclusion, and corrupt CRC failure isolation.

Parser reference: https://fitdecode.readthedocs.io/en/latest/reference/reader.html
