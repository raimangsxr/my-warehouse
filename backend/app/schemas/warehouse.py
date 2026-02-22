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
