"""Request shape for the Runsight Assistant. Matches ChatRequest in app/frontend/src/types/chat.ts."""

from datetime import date
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.models.camel import CamelModel

MAX_MESSAGES = 20  # the frontend sends only the latest turns
MAX_MESSAGE_CHARS = 2000  # same limit as the chat input
MAX_ASSISTANT_CHARS = 8000  # earlier replies come back as history


class ChatMessage(CamelModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_ASSISTANT_CHARS)

    @model_validator(mode="after")
    def check_user_length(self):
        if self.role == "user" and len(self.content) > MAX_MESSAGE_CHARS:
            raise ValueError(f"User messages are limited to {MAX_MESSAGE_CHARS} characters")
        return self


class ChatFilters(CamelModel):
    """The shared analysis filters active in the app, so answers match the charts."""

    start: date | None = None
    end: date | None = None
    excluded_run_ids: list[str] = Field(default_factory=list, max_length=1000)
    min_pace: float | None = Field(default=None, gt=0, allow_inf_nan=False)  # min/mile
    max_pace: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    min_distance: float | None = Field(default=None, ge=0, allow_inf_nan=False)  # miles
    max_distance: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    elevation: str | None = None  # dropdown range label, e.g. "0–100"
    temperature: str | None = None  # dropdown range label, e.g. "70–80"

    @model_validator(mode="after")
    def check_bounds(self):
        if self.min_pace is not None and self.max_pace is not None and self.min_pace > self.max_pace:
            raise ValueError("minPace must not exceed maxPace")
        if self.min_distance is not None and self.max_distance is not None and self.min_distance > self.max_distance:
            raise ValueError("minDistance must not exceed maxDistance")
        return self


class ChatRequest(CamelModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    filters: ChatFilters = Field(default_factory=ChatFilters)

    @field_validator("messages")
    @classmethod
    def ends_with_user(cls, messages: list[ChatMessage]):
        if messages[-1].role != "user":
            raise ValueError("The last message must come from the user")
        return messages
