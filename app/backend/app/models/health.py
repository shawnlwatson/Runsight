"""Response shape for the Insights fatigue chart. Matches FatigueRun in app/frontend/src/types/fatigue.ts."""

from pydantic import AliasChoices, Field

from app.models.camel import CamelModel


class FatigueRun(CamelModel):
    """One run plus that date's health values from daily_health. Null = unavailable."""

    id: str = Field(validation_alias=AliasChoices("_id", "id"))
    date: str  # YYYY-MM-DD
    pace: float | None  # min/mile, from the run

    # From the daily_health join. Null when the run's date has no health row
    sleep_hours: float | None = None  # prior-night sleep, hours
    active_energy_kcal: float | None = None  # daily active energy, not workout calories
    steps: float | None = None  # daily step count and 0 is valid. float: synthetic rows have fractions
