from datetime import datetime

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

WarehouseRole = Literal["administrator", "contributor"]


class WarehouseCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WarehouseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    created_by: str
    created_at: datetime
    membership_created_at: datetime
    role: WarehouseRole


class WarehouseOverviewMemberResponse(BaseModel):
    user_id: str
    display_name: str | None
    email: str | None
    role: WarehouseRole


class WarehouseOverviewResponse(WarehouseResponse):
    active_item_count: int
    stock_unit_count: int
    active_box_count: int
    open_batch_count: int
    member_count: int
    members: list[WarehouseOverviewMemberResponse]


class MemberResponse(BaseModel):
    user_id: str
    warehouse_id: str
    email: str
    display_name: str | None
    role: WarehouseRole
    created_at: datetime


class MemberRoleUpdateRequest(BaseModel):
    role: WarehouseRole


class WarehouseInviteCreateRequest(BaseModel):
    email: EmailStr | None = None
    expires_in_hours: int = Field(default=72, ge=1, le=168)
    role: WarehouseRole = "contributor"


class WarehouseInviteResponse(BaseModel):
    warehouse_id: str
    invite_token: str
    invite_url: str
    expires_at: datetime
    role: WarehouseRole
    email_delivery_status: Literal["sent", "not_configured", "failed", "not_requested"]
    email_delivery_message: str


class InviteAcceptResponse(BaseModel):
    message: str
    warehouse_id: str


class WarehouseDeleteRequest(BaseModel):
    confirm_name: str = Field(min_length=1, max_length=120)


class WarehouseDeleteResponse(BaseModel):
    message: str = "Warehouse deleted"


class ActivityEventResponse(BaseModel):
    id: str
    warehouse_id: str
    actor_user_id: str
    event_type: str
    entity_type: str | None
    entity_id: str | None
    metadata: dict
    created_at: datetime
