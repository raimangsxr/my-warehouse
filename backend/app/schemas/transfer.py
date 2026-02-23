from datetime import datetime

from pydantic import BaseModel, Field


class ExportWarehouse(BaseModel):
    id: str
    name: str


class ExportBox(BaseModel):
    id: str
    parent_box_id: str | None
    name: str
    description: str | None
    physical_location: str | None
    short_code: str
    qr_token: str
    version: int
    deleted_at: datetime | None


class ExportItem(BaseModel):
    id: str
    box_id: str
    name: str
    description: str | None
    photo_url: str | None
    physical_location: str | None
    tags: list[str]
    aliases: list[str]
    version: int
    deleted_at: datetime | None


class ExportStockMovement(BaseModel):
    id: str
    item_id: str
    delta: int
    command_id: str
    note: str | None
    created_at: datetime


class WarehouseExportResponse(BaseModel):
    schema_version: int = 1
    exported_at: datetime
    warehouse: ExportWarehouse
    boxes: list[ExportBox]
    items: list[ExportItem]
    stock_movements: list[ExportStockMovement]


class WarehouseImportRequest(BaseModel):
    schema_version: int = 1
    warehouse: ExportWarehouse
    boxes: list[ExportBox] = Field(default_factory=list)
    items: list[ExportItem] = Field(default_factory=list)
    stock_movements: list[ExportStockMovement] = Field(default_factory=list)


class WarehouseImportResponse(BaseModel):
    message: str
    boxes_upserted: int
    items_upserted: int
    stock_movements_upserted: int
