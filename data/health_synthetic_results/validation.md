# Health synthetic-data validation

Seed: 20261205. Original nonempty cells verified at raw XML precision: 3883.

Counts below exclude date/time, main flags, and data-source text.

| Sheet | Variable | Measured | Synthetic model | Synthetic prior | Missing |
| --- | --- | ---: | ---: | ---: | ---: |
| Daily Metrics | Active Energy | 365 | 1762 | 0 | 0 |
| Daily Metrics | Resting Energy | 365 | 1762 | 0 | 0 |
| Daily Metrics | Resting | 363 | 1756 | 0 | 8 |
| Daily Metrics | HRV | 363 | 1755 | 0 | 9 |
| Daily Metrics | Steps | 365 | 1762 | 0 | 0 |
| Daily Metrics | VO₂ max | 101 | 464 | 0 | 1562 |
| Daily Metrics | Exercise Minutes | 365 | 1762 | 0 | 0 |
| Daily Metrics | Stand Hours | 365 | 1762 | 0 | 0 |
| Sleep | Start | 29 | 2098 | 0 | 0 |
| Sleep | End | 29 | 2098 | 0 | 0 |
| Sleep | InBed | 29 | 2098 | 0 | 0 |
| Sleep | Asleep | 29 | 2098 | 0 | 0 |
| Sleep | Awake | 29 | 2098 | 0 | 0 |
| Sleep | REM | 28 | 2099 | 0 | 0 |
| Sleep | Core | 28 | 2099 | 0 | 0 |
| Sleep | Deep | 28 | 2099 | 0 | 0 |
| Sleep | Wake Count | 29 | 2098 | 0 | 0 |
| Sleep | Efficiency | 29 | 2098 | 0 | 0 |
| Sleep | Fall Asleep | 0 | 0 | 0 | 2127 |
| Sleep | Min. Respiration Rate | 28 | 2019 | 0 | 80 |
| Sleep | Max. Respiration Rate | 28 | 2019 | 0 | 80 |
| Sleep | Avg. Respiration Rate | 28 | 2019 | 0 | 80 |
| Sleep | Wrist Temperature | 7 | 511 | 0 | 1609 |
| Sleep | Low SpO2 | 28 | 2019 | 0 | 80 |
| Sleep | High SpO2 | 28 | 2019 | 0 | 80 |
| Sleep | Avg. SpO2 | 28 | 2019 | 0 | 80 |
| Sleep | Low HRV | 28 | 2019 | 0 | 80 |
| Sleep | High HRV | 28 | 2019 | 0 | 80 |
| Sleep | Avg. HRV | 28 | 2019 | 0 | 80 |
| Womens Health | Start of Cycle | 0 | 0 | 2127 | 0 |
| Womens Health | Menstruation | 0 | 0 | 2127 | 0 |

Sleep checks: no duration, efficiency, stage, or minimum/average/maximum ordering failures.
Original March 8, 2026 clock-window discrepancy is preserved and reported separately.

See variable_validation.csv for ranges, quantiles, missingness and counts; temporal_validation.csv for consecutive-day autocorrelation; relationship_validation.csv for within-tab pairwise comparisons.

Diagnostic PNG and PDF files compare measured and synthetic distributions and full-range time series.

## Modeling limits

- Sleep distributions are based on 29 nights; temporal persistence is an explicit prior.
- Auxiliary availability rates are conditional on recorded nights, not overall historical sensor use.
- Womens Health is fictional and independent of all health variables.
- Original missing measurement schedules are retained; no FIT or performance inputs are read.
- Historical stationarity is a visualization assumption, not reconstructed history.
