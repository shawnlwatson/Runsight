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
| `POST /insights/chat` | Runsight Assistant answer, streamed as newline-delimited JSON events (`ChatEvent`) |

`start` and `end` are optional `YYYY-MM-DD` dates.

### Runsight Assistant

The Insights chat sends the conversation and the shared filters (dates, pace, distance, elevation, temperature, and excluded runs) to `POST /insights/chat`. The backend runs a tool-calling loop through an OpenAI-compatible API: Google Gemini by default, or [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). The model can summarize a period, list runs, describe a metric over time, correlate two metrics (Pearson r with a 95% interval, Spearman rho, sample size, and an evidence label), and compare one run with the rest. Every tool sees only the runs that pass the user's filters, and tool code lives in `app/backend/app/services/chat_tools.py`.

Configuration (root `.env` locally, project environment variables on Vercel):

- `GEMINI_API_KEY`: a free key from [Google AI Studio](https://aistudio.google.com/apikey). Takes precedence when set. The free tier is rate limited, and Google may use free-tier prompts, which include run and health values, to improve its products.
- `AI_GATEWAY_API_KEY`: alternative provider. On Vercel, AI Gateway authenticates with the deployment's OIDC token, so the key is only needed locally.
- `AI_MODEL`: optional model ID for the active provider. Defaults are `gemini-2.5-flash` and `anthropic/claude-haiku-5.5`.

Without credentials the endpoint returns `503` and the chat shows that the assistant is not set up. Requests are limited to the latest 20 messages and 2,000 characters per user message.

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

## Data sources and attribution

Weather for runs without watch data comes from the [Open-Meteo](https://open-meteo.com/) historical weather API, using its archive endpoint (`archive-api.open-meteo.com`). Open-Meteo data is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit it wherever these values are shown or reported:

> Weather data by Open-Meteo.com (https://open-meteo.com/), licensed under CC BY 4.0.

Open-Meteo's free tier is for non-commercial use. Its archive values are modeled reanalysis estimates on a grid, not station measurements. Runs use watch-recorded temperature and humidity whenever the watch has them, and `temperatureSource` and `humiditySource` record where each value came from. See [weather join plan](docs/weather-join.md).

## Analysis exclusions

Use the minus-circle action in a run list, or **Exclude from analysis** in run details, to omit a run from analysis without deleting it. Exclusions apply across Dashboard, Trends, Runs, Explore, and Insights, including chart scales, outlier rankings, weekly totals, radar comparisons, and both periods of dashboard comparisons.

When runs are excluded, a shared panel below the page content provides **Review excluded runs**, individual **Restore** actions, and **Restore all**. Date changes and the All Time button do not reset exclusions. They are saved in this browser and synchronize between its tabs; they are not yet saved to a user account. If browser storage is blocked, they last only for the current tab session.

The summary endpoint accepts repeated `exclude_id` parameters, for example `/runs/summary?exclude_id=run-1&exclude_id=run-2`, optional inclusive `min_pace` / `max_pace` bounds in decimal minutes per mile, inclusive `min_distance` / `max_distance` bounds in miles, and `elevation` / `temperature` range labels matching the dropdown options. The older `distance` bucket parameter remains supported for compatibility. These filter both comparison periods without modifying MongoDB. Restart the backend after updating so dashboard comparisons support these parameters.

## Current analysis interface

- Dashboard includes a distance/pace scatterplot with distance-group boxplots and **Prior 30-Day Volume and Pace**, a per-run scatterplot colored by run distance. Its lookback totals use the available prior history before applying the displayed date and dashboard filters.
- Trends includes **Pace Consistency Over Time**, using a trailing median and interquartile range over the latest ten selected runs. Pace vs. Temperature uses a rolling median and interquartile range from the nearest ten selected runs by temperature, including ties at the window boundary; smaller selections use all available runs. Both charts flag runs beyond their local 1.5×IQR fences once at least four runs are available. Heart Rate by Temperature occupies the right half-width card and has an editable pace range. The full-width bottom card is a placeholder for a future chart. The previous temperature scatterplot component remains available in the source.
- Custom Views offers two to nine parallel-coordinate axes. Custom Views and Fatigue and Pace highlight a whole run on hover or keyboard focus and display its selected metrics.
- Trends, Runs, Explore, and Insights show compact summary cards stacked vertically in the sidebar. Run-list columns support ascending and descending sorting.
- The FilterBar is displayed on Dashboard in this order: minimum/maximum distance, minimum/maximum pace, elevation, temperature. Its state lives in the shared app layout, like the date range, and persists when navigating between pages. The filters apply across Dashboard, Trends, Runs, Explore, and Insights, including charts, run lists, outlier rankings, radar references, health charts, sidebar summaries, and previous-period comparisons. Distance inputs accept nonnegative decimal miles; pace inputs use m:ss per mile. Both include their endpoints and accept blank bounds for no limit. Elevation and temperature dropdown ranges include their lower bound and exclude their upper bound; missing measurements are omitted only when their filter is active. Reset filters clears the shared controls while preserving dates and excluded runs. All Time changes dates without clearing filters. The volume chart calculates lookbacks from full non-excluded history before filtering visible marks. The temperature/heart-rate chart on Trends further narrows the shared selection with its own pace controls.
- Runsight Assistant on Insights answers questions about the selected runs through the backend and Gemini (or Vercel AI Gateway). Answers stream in with a status line while the assistant checks the data, can be stopped, and report how much evidence supports each pattern. The conversation stays in page memory and clears on reload. See [Runsight Assistant](#runsight-assistant).

## Documentation and validation

See [FIT inventory documentation](docs/README-fit-inventory.md) and [synthetic-data methodology](docs/synthetic-methodology.md). Generated observations use `synthetic_model` or `synthetic_prior`; original observations use `measured`. Existing measured workbook values remain unchanged.

```bash
cd pipeline
../.venv/bin/python -m unittest -q test_fit_inventory
cd ../data/synthetic/generator
../../../.venv/bin/python -m unittest -q test_generate_health
cd ../../../app/backend
../../.venv/bin/python -m unittest -q tests/test_runs.py tests/test_chat.py
```

Environments, Python caches, Windows download sidecars, and local credential files are excluded from Git. Data and reports are included as requested.

The existing local Python environment at `data/.venv` can also run the relocated tooling; a fresh setup uses the root `.venv` shown above.
