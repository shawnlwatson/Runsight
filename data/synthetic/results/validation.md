# Health synthetic-data validation

Seed: 20261205. Original nonempty cells verified at raw XML precision: 3883.

Counts below exclude date/time, main flags, and data-source text.

| Sheet | Variable | Measured | Synthetic model | Synthetic prior | Missing |
| --- | --- | ---: | ---: | ---: | ---: |
| Daily Metrics | Active Energy | 365 | 1782 | 0 | 0 |
| Daily Metrics | Resting Energy | 365 | 1782 | 0 | 0 |
| Daily Metrics | Resting | 363 | 1775 | 0 | 9 |
| Daily Metrics | HRV | 363 | 1772 | 0 | 12 |
| Daily Metrics | Steps | 365 | 1782 | 0 | 0 |
| Daily Metrics | VO₂ max | 101 | 462 | 0 | 1584 |
| Daily Metrics | Exercise Minutes | 365 | 1782 | 0 | 0 |
| Daily Metrics | Stand Hours | 365 | 1782 | 0 | 0 |
| Sleep | Start | 29 | 2118 | 0 | 0 |
| Sleep | End | 29 | 2118 | 0 | 0 |
| Sleep | InBed | 29 | 2118 | 0 | 0 |
| Sleep | Asleep | 29 | 2118 | 0 | 0 |
| Sleep | Awake | 29 | 2118 | 0 | 0 |
| Sleep | REM | 28 | 2119 | 0 | 0 |
| Sleep | Core | 28 | 2119 | 0 | 0 |
| Sleep | Deep | 28 | 2119 | 0 | 0 |
| Sleep | Wake Count | 29 | 2118 | 0 | 0 |
| Sleep | Efficiency | 29 | 2118 | 0 | 0 |
| Sleep | Fall Asleep | 0 | 0 | 0 | 2147 |
| Sleep | Min. Respiration Rate | 28 | 2037 | 0 | 82 |
| Sleep | Max. Respiration Rate | 28 | 2037 | 0 | 82 |
| Sleep | Avg. Respiration Rate | 28 | 2037 | 0 | 82 |
| Sleep | Wrist Temperature | 7 | 522 | 0 | 1618 |
| Sleep | Low SpO2 | 28 | 2037 | 0 | 82 |
| Sleep | High SpO2 | 28 | 2037 | 0 | 82 |
| Sleep | Avg. SpO2 | 28 | 2037 | 0 | 82 |
| Sleep | Low HRV | 28 | 2037 | 0 | 82 |
| Sleep | High HRV | 28 | 2037 | 0 | 82 |
| Sleep | Avg. HRV | 28 | 2037 | 0 | 82 |
| Womens Health | Start of Cycle | 0 | 0 | 2147 | 0 |
| Womens Health | Menstruation | 0 | 0 | 2147 | 0 |

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
