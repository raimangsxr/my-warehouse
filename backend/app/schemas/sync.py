from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class SyncCommandRequest(BaseModel):
    command_id: str = Field(min_length=6, max_length=64)
    type: str = Field(min_length=3, max_length=64)
    entity_id: str | None = None
    base_version: int | None = None
    payload: dict = Field(default_factory=dict)


class SyncPushRequest(BaseModel):
    warehouse_id: str
    device_id: str = Field(min_length=3, max_length=128)
    commands: list[SyncCommandRequest] = Field(min_length=1)


class SyncConflictResolution(str, Enum):
    keep_server = "keep_server"
    keep_client = "keep_client"
    merge = "merge"


class SyncConflictResponse(BaseModel):
    id: str
    warehouse_id: str
    command_id: str
    entity_type: str
    entity_id: str
    base_version: int | None
    server_version: int | None
    client_payload: dict
    status: str
    created_at: datetime
    resolved_at: datetime | None


class SyncPushResponse(BaseModel):
    applied_command_ids: list[str]
    skipped_command_ids: list[str]
    conflicts: list[SyncConflictResponse]
    last_seq: int


class SyncChangeEntry(BaseModel):
    seq: int
    warehouse_id: str
    entity_type: str
    entity_id: str | None
    action: str
    entity_version: int | None
    payload: dict
    created_at: datetime


class SyncPullResponse(BaseModel):
    changes: list[SyncChangeEntry]
    conflicts: list[SyncConflictResponse]
    last_seq: int


class SyncResolveRequest(BaseModel):
    warehouse_id: str
    conflict_id: str
    resolution: SyncConflictResolution
    payload: dict = Field(default_factory=dict)


class SyncResolveResponse(BaseModel):
    message: str
    conflict: SyncConflictResponse
