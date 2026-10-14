# HealthFit synthetic test-data generator

The maintained generator is `generate_health.py`; editable parameters are in `config.json`. It extends Daily Metrics, Sleep, and Womens Health from 2020-12-05 through the latest observed date in the input workbook. For Health Metrics_v6.xlsx that is 2026-10-01, or 2,127 dates. Weight, Nutrition, Mindfulness, Blood Sugar, and Blood Pressure are kept unchanged.

## Run

The Runsight environment is already installed:

```bash
/home/shawn/Runsight/data/.venv/bin/python /home/shawn/Runsight/data/health_synthetic/generate_health.py
```

Choose a different seed, configuration, or output directory:

```bash
/home/shawn/Runsight/data/.venv/bin/python /home/shawn/Runsight/data/health_synthetic/generate_health.py \
  --input '/home/shawn/Runsight/data/raw/Health Metrics_v6.xlsx' \
  --config /home/shawn/Runsight/data/health_synthetic/config.json \
  --seed 1234 --output-dir /tmp/health-test
```

To install elsewhere, use Python 3.12 and the pinned dependency file. Run from `Runsight/data`:

```bash
python3 -m venv .venv
.venv/bin/pip install -r health_synthetic/requirements.txt
.venv/bin/python health_synthetic/generate_health.py --input /path/to/HealthFit.xlsx --output-dir /path/to/output
```

Defaults resolve relative to the script, not the working directory. Re-running refreshes generated files in the chosen output directory. The original input workbook is never overwritten. Use separate output directories to retain alternative seeds or configurations. `--no-plots` skips plots for faster checks.

## Method

### Daily Metrics

A Gaussian copula maps correlated AR processes into empirical measured distributions. Missing measured values are excluded from fitting. Copula correlations are shrunk for stability. Autocorrelation is estimated only from consecutive calendar-day pairs, with positive persistence bounded to avoid unstable extrapolation. Weekday effects are estimated conservatively. Measured observations anchor scalar AR bridge corrections near boundaries; measured cells themselves are not replaced.

VO2 max is modeled separately as an independent, bounded, mean-reverting latent process with configurable persistence (default 0.98 per day). Its measurement availability follows the measured rate (101/365) using a clustered availability process. It is intentionally not conditioned on exercise, FIT records, or workout performance. Other daily availability rates also use observed frequencies. Existing dates retain their original measurement schedules, including missing VO2, resting HR, and HRV cells. Zeros are valid measurements.

Synthetic energy values stay within measured bounds; steps, exercise minutes, stand hours, and resting HR are rounded to integers. Original fractional observations remain untouched. Synthetic values need not exactly reproduce every sample statistic; diagnostic comparisons expose differences.

### Sleep

Generate one main nightly record per date. With only 29 measured nights, use empirical distributions and composition rather than fitting a large relationship network. Temporal persistence of 0.3 is an explicit configurable testing assumption, not an estimate of historical sleep behavior.

InBed and Efficiency are sampled as bounded, persistent processes. Asleep and Awake follow from their structural relationship, with constraints keeping their durations within observed ranges. Bedtime is unwrapped around noon to handle midnight correctly, and End follows from Start plus InBed. Synthetic clock windows reconcile within serialization tolerance. Original time discrepancies remain unchanged.

Stage proportions use measured compositions with modest jitter. Durations are allocated to sum to Asleep. Stage durations have conservative upper bounds of 1.15 times observed maxima to prevent stretching short-night compositions into extreme long-night values. For the one measured night without stages, synthetic stages are generated to match its measured Asleep duration; measured totals remain untouched.

Respiration, SpO2, and HRV auxiliary groups share an availability mask reflecting their observed joint missingness (28/29). Wrist temperature uses its observed conditional frequency (7/29). These rates describe availability among recorded sleep nights; the workbook does not establish historical sensor availability over the full six years. Existing auxiliary gaps are retained. Minimum/average/maximum summaries remain ordered. Wrist temperature is bounded by its seven measured values; uncertainty is acknowledged rather than fitting trends from them.

Fall Asleep stays empty by default. To populate it, increase `sleep.fall_asleep_probability` between 0 and 1. Its configurable triangular duration prior defaults to 5/15/45 minutes and is capped by Awake. Such values always receive `synthetic_prior` provenance.

### Womens Health

An independent random stream generates entirely fictional cycles. Cycle lengths default to a rounded normal distribution centered on 28 days, bounded to 24–35 days; menstruation duration varies from 3–7 days. A random initial phase means the first output date need not start a cycle. Full cycles are generated across output boundaries, so the first and last visible cycles may be partial.

The original Date, Time, Start of Cycle, Menstruation, and Data Source columns are retained. Start of Cycle is Boolean; Menstruation uses explicit test labels None/Light/Medium/Heavy; Time is an arbitrary 12:00 testing timestamp. The empty source tab does not establish HealthFit's import enum conventions, so these encodings are documented in Generation Info for consumers to map if necessary. Every Womens Health cell is `synthetic_prior`. If a future workbook contains measured Womens Health records, the generator refuses to replace them.

No synthetic cycles affect any Daily Metrics or Sleep values. No FIT files or running-performance variables are loaded or used anywhere in the generator. Real measured observations can contain existing activity relationships, which are preserved.

## Preservation and provenance

HealthFit tabs retain original names, header text (including spaces), column order, formats, and units. Added rows follow the original descending date order. Auxiliary tabs are added:

- **Provenance**: one row per populated cell, labeled `measured`, `synthetic_model`, or `synthetic_prior`.
- **Record Provenance**: categories and cell counts per record. A record with measured and synthetic cells lists both categories explicitly.
- **Generation Info**: configuration, seed, source SHA-256, dependency versions, date range, assumptions, and categorical encodings.

Empty cells have no value provenance; validation missingness counts describe them. Existing source descriptions are retained; new synthetic sleep records identify their source as `synthetic_model`, and Womens Health uses `synthetic_prior`.

Spreadsheet libraries round Excel durations on reading. After saving the output, the generator restores nonempty source cells directly from workbook XML at their new row locations, preserving original numeric precision and strings. All restored cells are compared against their source payloads. There are 3,883 original nonempty cells in this workbook, including headers, date keys, and source metadata. The original workbook's file hash is also checked after generation.

Independent seed streams separate Daily Metrics, Sleep, and Womens Health. Identical inputs/configuration with pinned dependencies produce identical generated values, reports, and workbook bytes. Workbook package timestamps are normalized for reproducibility; they do not represent observation dates. A seed change changes generated values only.

## Deliverables

Default directory: `../health_synthetic_results/`.

- `Health Metrics_synthetic.xlsx`: new workbook and provenance tabs.
- `validation.md`: readable counts, consistency results, and limitations.
- `validation.json`: every variable's distribution/ranges/categories, measured/model/prior counts, missingness, model parameters, cycle statistics, and sleep exceptions.
- `variable_validation.csv`: one row per variable and provenance category, including source records/missingness and output records/missingness. Sleep durations are summarized in hours; proportions remain fractions as in Excel.
- `temporal_validation.csv`: lag-one correlations with actual consecutive-day pair counts, separately by provenance.
- `relationship_validation.csv`: within-tab pairwise measured versus modeled correlations with sample counts.
- `provenance.csv`: the cell-level provenance table.
- `daily_metrics_diagnostics.png/.pdf` and `sleep_diagnostics.png/.pdf`: measured-versus-synthetic distributions with shared histogram bins, and full-range time-series scatter plots. Points retain visibility of sparse observations without joining gaps.
- `run_metadata.json` and `config_used.json`: reproducible configuration and dependency metadata.

The plots and reports intentionally distinguish measured and synthetic values. Synthetic history is a testing fixture, not a physiological reconstruction or a claim about unobserved years. Small-sample sleep distributions and long-range stationarity are material modeling assumptions.

## Tests

```bash
cd /home/shawn/Runsight/data
.venv/bin/python -m unittest -q health_synthetic.test_generate_health
```

Integration tests verify source-cell values and formats, raw precision checks, unchanged source hash, identical seeded workbook/report bytes, full date grids, retained measurement schedules, realistic measurement frequencies, bounded VO2, saved-workbook sleep identities and summary ordering, provenance categories, cycle variation, configurable Fall Asleep prior behavior, and changed-seed variability.
