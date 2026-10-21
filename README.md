# Runsight

Running analytics frontend and health/workout data tooling.

This private repository contains personal FIT workouts, measured health data, generated test data, and the scripts that analyze or extend those data. Synthetic observations are explicitly identified and do not reconstruct historical physiology.

## Structure

- `data/raw/`: original source data, never written to by code.
  - `fit/`: original workout FIT files.
  - `Health Metrics_v6.xlsx`: original measured HealthFit workbook.
- `data/synthetic/`: synthetic-data generation.
  - `generator/`: maintained generator (`generate_health.py`), configuration, pinned dependencies, integration tests.
  - `results/`: generated workbook, provenance, validation reports, and diagnostic plots.
- `data/derived/fit_inventory/`: CSV/JSON inventories and weather coverage analyses computed from `data/raw/fit`.
- `pipeline/`: data-processing scripts, independent of the product app.
  - `fit_inventory.py`, `test_fit_inventory.py`, `requirements-fit.txt`.
- `app/frontend/`: Next.js, React, TypeScript, Tailwind CSS, and D3 frontend: Dashboard, Trends, Runs, Explore, and Insights.
- `app/backend/`: reserved for the backend API and statistics engine.
- `docs/`: design background and methodology documentation.
  - `context.txt`: research background, design requirements, and development plan.
  - `README-fit-inventory.md`, `synthetic-methodology.md`.

## Frontend development

Use Node.js and npm installed inside WSL/Ubuntu:

```bash
cd app/frontend
npm ci
npm run dev
```

Open http://localhost:3000. Run `npm run lint` and `npm run build` from `app/frontend` to validate the UI. See [frontend documentation](app/frontend/README.md).

The frontend uses fictional fixtures in `app/frontend/src/data/fixtures`. Shared data contracts live in `app/frontend/src/types`.

## Data tooling setup

Python 3.12 was used for the current outputs.

```bash
python3 -m venv .venv
.venv/bin/pip install -r pipeline/requirements-fit.txt -r data/synthetic/generator/requirements.txt
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

## Documentation and validation

See [FIT inventory documentation](docs/README-fit-inventory.md) and [synthetic-data methodology](docs/synthetic-methodology.md). Generated observations use `synthetic_model` or `synthetic_prior`; original observations use `measured`. Existing measured workbook values remain unchanged.

```bash
cd pipeline
../.venv/bin/python -m unittest -q test_fit_inventory
cd ../data/synthetic/generator
../../../.venv/bin/python -m unittest -q test_generate_health
```

Environments, Python caches, Windows download sidecars, and local credential files are excluded from Git. Data and reports are included as requested.

The existing local Python environment at `data/.venv` can also run the relocated tooling; a fresh setup uses the root `.venv` shown above.
