from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class IntakeDraftStatus(str, Enum):
    uploaded = "uploaded"
    processing = "processing"
    ready = "ready"
    review = "review"
    rejected = "rejected"
    error = "error"
    committed = "committed"


class IntakeBatchStatus(str, Enum):
    drafting = "drafting"
    processing = "processing"
    review = "review"
    committed = "committed"


class IntakeDraftReprocessMode(str, Enum):
    photo = "photo"
    name = "name"


class IntakeBatchCreateRequest(BaseModel):
    target_box_id: str
    name: str | None = Field(default=None, min_length=1, max_length=120)


class IntakeBatchStartRequest(BaseModel):
    retry_errors: bool = False


class IntakeBatchCommitRequest(BaseModel):
    include_review: bool = False


class IntakeDraftUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=1000)
    tags: list[str] | None = None
    aliases: list[str] | None = None
    quantity: int | None = Field(default=None, ge=1, le=9999)
    status: IntakeDraftStatus | None = None


class IntakeDraftReprocessRequest(BaseModel):
    mode: IntakeDraftReprocessMode = IntakeDraftReprocessMode.photo


class IntakeDraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    warehouse_id: str
    batch_id: str
    photo_url: str
    status: IntakeDraftStatus
    position: int
    name: str | None
    description: str | None
    tags: list[str]
    aliases: list[str]
    confidence: float = Field(ge=0.0, le=1.0)
    warnings: list[str]
    llm_used: bool
    error_message: str | None
    processing_attempts: int
    quantity: int = Field(ge=1, le=9999)
    committed_quantity: int = Field(ge=0, le=9999)
    created_item_id: str | None
    created_at: datetime
    updated_at: datetime


class IntakeBatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    warehouse_id: str
    target_box_id: str
    target_box_name: str | None = None
    created_by: str
    name: str | None
    status: IntakeBatchStatus
    total_count: int
    processed_count: int
    committed_count: int
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    updated_at: datetime
    status_counts: dict[str, int] = Field(default_factory=dict)


class IntakeBatchDetailResponse(BaseModel):
    batch: IntakeBatchResponse
    drafts: list[IntakeDraftResponse] = Field(default_factory=list)


class IntakeBatchUploadResponse(BaseModel):
    batch: IntakeBatchResponse
    drafts: list[IntakeDraftResponse] = Field(default_factory=list)
    uploaded_count: int


class IntakeBatchStartResponse(BaseModel):
    message: str
    batch: IntakeBatchResponse


class IntakeBatchCommitResponse(BaseModel):
    batch: IntakeBatchResponse
    created: int
    skipped: int
    errors: int
