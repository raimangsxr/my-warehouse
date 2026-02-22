from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BoxCreateRequest(BaseModel):
    parent_box_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    physical_location: str | None = Field(default=None, max_length=255)


class BoxUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    physical_location: str | None = Field(default=None, max_length=255)


class BoxMoveRequest(BaseModel):
    new_parent_box_id: str | None = None


class BoxDeleteRequest(BaseModel):
    force: bool = False


class BoxResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    warehouse_id: str
    parent_box_id: str | None
    name: str
    description: str | None
    physical_location: str | None
    short_code: str
    qr_token: str
    version: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class BoxTreeNode(BaseModel):
    box: BoxResponse
    level: int
    total_items_recursive: int
    total_boxes_recursive: int


class BoxItemResponse(BaseModel):
    id: str
    box_id: str
    name: str
    description: str | None
    physical_location: str | None
    stock: int
    box_path: list[str]
    box_path_ids: list[str]


class BoxByQrResponse(BaseModel):
    box_id: str
    warehouse_id: str
    short_code: str
    name: str
