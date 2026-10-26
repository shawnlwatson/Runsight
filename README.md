# Runsight

Running analytics frontend and health/workout data tooling.

This private repository contains personal FIT workouts, measured health data, generated test data, and the scripts that analyze or extend those data. Synthetic observations are explicitly identified and do not reconstruct historical physiology.

## Structure

- `data/raw/`: original source data, never written to by code.
  - `fit/`: original workout FIT files.
  - `Health Metrics_v6.xlsx`: original measured HealthFit workbook.
- `data/synthetic/`: synthetic-data generation.
  - `generator/`: maintained generator (`generate_health.py`), configuration, integration tests.
  - `results/`: generated workbook, provenance, validation reports, and diagnostic plots.
- `data/derived/fit_inventory/`: CSV/JSON inventories and weather coverage analyses computed from `data/raw/fit`.
- `pipeline/`: data-processing scripts, independent of the product app.
  - `fit_inventory.py`, `test_fit_inventory.py`.
  - `load_runs.py`, `load_health.py`: load FIT runs and daily health data into MongoDB.
- `requirements.txt`: pinned Python dependencies for the data tooling and backend.
- `app/frontend/`: Next.js, React, TypeScript, Tailwind CSS, and D3 frontend: Dashboard, Trends, Runs, Explore, and Insights.
- `app/backend/`: FastAPI backend that serves runs, health joins, and dashboard summaries from MongoDB.
- `docs/`: design background and methodology documentation.
  - `context.txt`: research background, design requirements, and development plan.
  - `README-fit-inventory.md`, `synthetic-methodology.md`.

## Data tooling setup

Python 3.12 was used for the current outputs.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Run the FIT inventory:

```bash
.venv/bin/python pipeline/fit_inventory.py
```

Run the reproducible health-data generator:

```bash
.venv/bin/python data/synthetic/generator/generate_health.py
```

Select another seed and preserve an alternative output separately:

```bash
.venv/bin/python data/synthetic/generator/generate_health.py --seed 1234 --output-dir data/synthetic/results_seed1234
```

## Backend development

The backend needs the Python environment from [Data tooling setup](#data-tooling-setup) and a MongoDB connection string in a root `.env` file. Copy `.env.example` to `.env` and fill in the group's connection string; never commit `.env`:

```bash
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/
```

Load the data into MongoDB (first time, or after the FIT files or health workbook change). Both scripts upsert, so re-running never duplicates:

```bash
.venv/bin/python pipeline/load_runs.py
.venv/bin/python pipeline/load_health.py
```

The run loader skips accidental recordings explicitly listed by stable run ID in `pipeline/excluded_runs.json`. Their original FIT files remain available for source auditing; excluded runs are not reinserted into MongoDB on later imports.

To fill a health coverage gap after the last workbook date, generate through the latest run date and load only the missing interval:

```bash
.venv/bin/python data/synthetic/generator/generate_health.py --end-date 2026-10-21
.venv/bin/python pipeline/load_health.py --start 2026-10-02 --end 2026-10-21 --insert-only
```

`--insert-only` keeps existing health records unchanged. Newly generated health values are synthetic test data, not measured observations. See the [generator methodology](docs/synthetic-methodology.md) for rerun behavior.

Start the API from `app/backend`:

```bash
cd app/backend
../../.venv/bin/fastapi dev app/main.py
```

The API runs at http://localhost:8000. Open http://localhost:8000/docs to try the endpoints and http://localhost:8000/healthz to confirm the MongoDB connection.

| Endpoint | Returns |
|---|---|
| `GET /runs?start=&end=` | Runs with prior-night sleep (`CurrentRun`) |
| `GET /runs/summary?start=&end=` | Dashboard totals for the period and the previous period |
| `GET /insights/fatigue?start=&end=` | Runs joined to sleep, steps, and active energy (`FatigueRun`) |

`start` and `end` are optional `YYYY-MM-DD` dates.

## Frontend development

Start the backend first. Copy `app/frontend/.env.example` to `app/frontend/.env.local` to point the frontend at it:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Use Node.js and npm installed inside WSL/Ubuntu:

```bash
cd app/frontend
npm ci
npm run dev
```

Open http://localhost:3000. Run `npm run lint` and `npm run build` from `app/frontend` to validate the UI. See [frontend documentation](app/frontend/README.md).

The frontend loads data from the FastAPI backend (`app/backend`) through `app/frontend/src/lib/api.ts`. Shared data contracts live in `app/frontend/src/types`.

## Analysis exclusions

Use the minus-circle action in a run list, or **Exclude from analysis** in run details, to omit a run from analysis without deleting it. Exclusions apply across Dashboard, Trends, Runs, Explore, and Insights, including chart scales, outlier rankings, weekly totals, radar comparisons, and both periods of dashboard comparisons.

When runs are excluded, a shared panel below the page content provides **Review excluded runs**, individual **Restore** actions, and **Restore all**. Date changes and the All Time button do not reset exclusions. They are saved in this browser and synchronize between its tabs; they are not yet saved to a user account. If browser storage is blocked, they last only for the current tab session.

The summary endpoint accepts repeated `exclude_id` parameters, for example `/runs/summary?exclude_id=run-1&exclude_id=run-2`. These only filter the calculation; they do not modify MongoDB. Restart the backend after updating to this version so dashboard comparisons support the new parameters.

## Current analysis interface

- Dashboard includes a distance/pace scatterplot with distance-group boxplots and a temperature/heart-rate bar chart with an editable pace range. The previous temperature scatterplot component remains available in the source.
- Trends includes **Pace Consistency Over Time**, using a trailing median and interquartile range over the latest ten selected runs. Pace vs. Temperature uses the selected cohort's median and interquartile range. Both charts flag runs beyond 1.5×IQR fences once at least four runs are available.
- Custom Views offers two to nine parallel-coordinate axes. Custom Views and Fatigue and Pace highlight a whole run on hover or keyboard focus and display its selected metrics.
- Trends, Runs, Explore, and Insights show compact summary cards stacked vertically in the sidebar. Run-list columns support ascending and descending sorting. The standalone FilterBar component is retained but is not displayed.
- Runsight Assistant on Insights is a frontend chat preview. Messages remain in page memory; AI responses and a chat backend are not connected.

## Documentation and validation

See [FIT inventory documentation](docs/README-fit-inventory.md) and [synthetic-data methodology](docs/synthetic-methodology.md). Generated observations use `synthetic_model` or `synthetic_prior`; original observations use `measured`. Existing measured workbook values remain unchanged.

```bash
cd pipeline
../.venv/bin/python -m unittest -q test_fit_inventory
cd ../data/synthetic/generator
../../../.venv/bin/python -m unittest -q test_generate_health
cd ../../../app/backend
../../.venv/bin/python -m unittest -q tests/test_runs.py
```

Environments, Python caches, Windows download sidecars, and local credential files are excluded from Git. Data and reports are included as requested.

The existing local Python environment at `data/.venv` can also run the relocated tooling; a fresh setup uses the root `.venv` shown above.
