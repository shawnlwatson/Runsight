"""Response shape for a run. Matches CurrentRun in app/frontend/src/types/run.ts."""

from pydantic import AliasChoices, Field

from app.models.camel import CamelModel


class Run(CamelModel):
    # Mongo's primary key is "_id", the frontend expects "id".
    # validation_alias only changes the input name, so the JSON output stays "id".
    id: str = Field(validation_alias=AliasChoices("_id", "id"))
    date: str  # local calendar date, YYYY-MM-DD

    # Required but nullable: every run document has these keys, even when the value is null.
    # A missing key raises an error, which catches a $project that forgot a field.
    total_time_seconds: float | None
    total_calories: float | None  # kcal
    is_indoor: bool | None  # null = environment unknown
    average_cadence_spm: float | None  # steps/min
    distance_miles: float | None
    pace: float | None  # decimal minutes per mile
    heart_rate: float | None  # average bpm
    elevation_feet: float | None
    temperature: float | None  # degrees F

    # From the daily_health join. Defaults to null when no health row matches the run's date
    sleep_hours: float | None = None
