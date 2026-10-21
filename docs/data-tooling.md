# Data tooling

Source data lives in `data/raw/fit` and `data/raw/Health Metrics_v6.xlsx`. Raw inputs are never modified by processing scripts.

- `pipeline/`: FIT inventory code, dependencies, and tests.
- `data/derived/fit_inventory/`: decoded field inventories and weather coverage reports.
- `data/synthetic/generator/`: reproducible health-data generator and tests.
- `data/synthetic/results/`: synthetic workbook, provenance, validation reports, and plots.

See the [repository setup](../README.md), [FIT inventory documentation](README-fit-inventory.md), and [synthetic-data methodology](synthetic-methodology.md).

From the repository root, using the existing local Python environment:

```bash
data/.venv/bin/python pipeline/fit_inventory.py
data/.venv/bin/python data/synthetic/generator/generate_health.py
```

A fresh installation can use the root `.venv` described in the repository README. Windows Zone Identifier sidecars and local environments are ignored by Git.
