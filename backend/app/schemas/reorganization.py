from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ReorganizationSuggestionItem(BaseModel):
    suggestion_id: str
    item_id: str
    item_name: str
    from_box_id: str
    from_box_name: str
    to_box_id: str
    to_box_name: str
    reason: str
    status: Literal["pending", "confirmed", "dismissed"]


class ReorganizationSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    warehouse_id: str
    created_by: str
    status: Literal["running", "ready", "error", "completed", "archived"]
    suggestions: list[ReorganizationSuggestionItem]
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class ReorganizationSessionCreate(BaseModel):
    pass  # body vacío; force viene como query param
