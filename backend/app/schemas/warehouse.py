from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WarehouseCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WarehouseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    created_by: str
    created_at: datetime


class MemberResponse(BaseModel):
    user_id: str
    warehouse_id: str
    created_at: datetime


class WarehouseInviteCreateRequest(BaseModel):
    email: str | None = Field(default=None, max_length=255)
    expires_in_hours: int = Field(default=72, ge=1, le=168)


class WarehouseInviteResponse(BaseModel):
    warehouse_id: str
    invite_token: str
    invite_url: str
    expires_at: datetime


class InviteAcceptResponse(BaseModel):
    message: str
    warehouse_id: str


class ActivityEventResponse(BaseModel):
    id: str
    warehouse_id: str
    actor_user_id: str
    event_type: str
    entity_type: str | None
    entity_id: str | None
    metadata: dict
    created_at: datetime
