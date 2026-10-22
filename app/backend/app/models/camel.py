from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base model: snake_case in Python, camelCase in JSON (what the frontend and Mongo use)."""

    model_config = ConfigDict(
        alias_generator=to_camel,   # total_time_seconds <-> totalTimeSeconds
        validate_by_name=True,      # also accept the Python name when building a model
        validate_by_alias=True
    )