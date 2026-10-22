"""Response shape for the Dashboard summary tiles. Matches DashboardSummary in app/frontend/src/types/summary.ts."""

from app.models.camel import CamelModel


class RunSummary(CamelModel):
    total_runs: int
    total_distance_miles: float
    avg_pace: float | None  # min/mile: total time / total distance. Null when no runs
    avg_heart_rate: float | None  # bpm


class DashboardSummary(CamelModel):
    current: RunSummary
    previous: RunSummary | None  # same-length period right before. Null unless start and end are given
