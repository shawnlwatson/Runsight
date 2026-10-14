# Runsight

Health and workout data tooling for visualization software testing.

This private repository contains personal FIT workouts, measured health data, generated test data, and the scripts that analyze or extend those data. Synthetic observations are explicitly identified and do not reconstruct historical physiology.

## Contents

- `raw/.FIT Files/`: original workout FIT files.
- `raw/Health Metrics_v6.xlsx`: original measured HealthFit workbook.
- `fit_inventory.py`: recursive FIT message/field inventory with workout coverage counts.
- `fit_inventory_results/`: CSV/JSON inventories and weather coverage analyses.
- `health_synthetic/`: maintained synthetic-data generator, configuration, pinned dependencies, integration tests, and methodology documentation.
- `health_synthetic_results/`: generated workbook, provenance, validation reports, and diagnostic plots.

## Setup

Python 3.12 was used for the current outputs. Run these commands from `Runsight/data`.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-fit.txt -r health_synthetic/requirements.txt
```

Run the FIT inventory:

```bash
.venv/bin/python fit_inventory.py
```

Run the reproducible health-data generator:

```bash
.venv/bin/python health_synthetic/generate_health.py
```

Select another seed and preserve an alternative output separately:

```bash
.venv/bin/python health_synthetic/generate_health.py --seed 1234 --output-dir health_synthetic_results_seed1234
```

## Documentation and validation

See [FIT inventory documentation](README-fit-inventory.md) and [synthetic-data methodology](health_synthetic/README.md). Generated observations use `synthetic_model` or `synthetic_prior`; original observations use `measured`. Existing measured workbook values remain unchanged.

```bash
.venv/bin/python -m unittest -q test_fit_inventory
.venv/bin/python -m unittest -q health_synthetic.test_generate_health
```

Environments, Python caches, Windows download sidecars, and local credential files are excluded from Git. Data and reports are included as requested.
