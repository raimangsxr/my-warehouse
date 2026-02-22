from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class ItemCreateRequest(BaseModel):
    box_id: str
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    photo_url: str | None = Field(default=None, max_length=500)
    physical_location: str | None = Field(default=None, max_length=255)
    tags: list[str] = Field(default_factory=list)
    aliases: list[str] = Field(default_factory=list)


class ItemUpdateRequest(BaseModel):
    box_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    photo_url: str | None = Field(default=None, max_length=500)
    physical_location: str | None = Field(default=None, max_length=255)
    tags: list[str] | None = None
    aliases: list[str] | None = None


class ItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    warehouse_id: str
    box_id: str
    name: str
    description: str | None
    photo_url: str | None
    physical_location: str | None
    tags: list[str]
    aliases: list[str]
    version: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    stock: int
    is_favorite: bool
    box_path: list[str]


class ItemFavoriteRequest(BaseModel):
    is_favorite: bool


class StockAdjustRequest(BaseModel):
    delta: int = Field(description="Solo +/-1 para ajuste rápido")
    command_id: str = Field(min_length=6, max_length=64)
    note: str | None = Field(default=None, max_length=255)


class ItemBatchAction(str, Enum):
    move = "move"
    favorite = "favorite"
    unfavorite = "unfavorite"
    delete = "delete"


class ItemBatchRequest(BaseModel):
    item_ids: list[str] = Field(min_length=1)
    action: ItemBatchAction
    target_box_id: str | None = None
