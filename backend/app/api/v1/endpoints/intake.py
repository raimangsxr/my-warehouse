from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_warehouse_membership
from app.core.config import settings
from app.db.session import get_db
from app.models.box import Box
from app.models.intake_batch import IntakeBatch
from app.models.intake_draft import IntakeDraft
from app.models.item import Item
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.intake import (
    IntakeBatchCommitRequest,
    IntakeBatchCommitResponse,
    IntakeBatchCreateRequest,
    IntakeBatchDetailResponse,
    IntakeBatchResponse,
    IntakeBatchStartRequest,
    IntakeBatchStartResponse,
    IntakeBatchUploadResponse,
    IntakeBatchStatus,
    IntakeDraftResponse,
    IntakeDraftStatus,
    IntakeDraftUpdateRequest,
)
from app.services.activity import record_activity
from app.services.intake_processing import process_intake_batch, refresh_batch_rollup, resolve_batch_status_counts
from app.services.sync_log import append_change_log

router = APIRouter(prefix="/warehouses/{warehouse_id}/intake", tags=["intake"])

_ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_MAX_FILES_PER_UPLOAD = 40


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _get_active_box(db: Session, warehouse_id: str, box_id: str) -> Box:
    box = db.scalar(
        select(Box).where(
            Box.id == box_id,
            Box.warehouse_id == warehouse_id,
            Box.deleted_at.is_(None),
        )
    )
    if box is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Box not found")
    return box


def _get_batch(db: Session, warehouse_id: str, batch_id: str) -> IntakeBatch:
    batch = db.scalar(
        select(IntakeBatch).where(
            IntakeBatch.id == batch_id,
            IntakeBatch.warehouse_id == warehouse_id,
        )
    )
    if batch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake batch not found")
    return batch


def _get_draft(db: Session, warehouse_id: str, draft_id: str) -> IntakeDraft:
    draft = db.scalar(
        select(IntakeDraft).where(
            IntakeDraft.id == draft_id,
            IntakeDraft.warehouse_id == warehouse_id,
        )
    )
    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Intake draft not found")
    return draft


def _sanitize_list(values: list[str] | None, *, max_count: int) -> list[str]:
    if values is None:
        return []
    cleaned: list[str] = []
    for value in values:
        token = " ".join(str(value).strip().split()).lower()
        if not token or token in cleaned:
            continue
        cleaned.append(token)
        if len(cleaned) >= max_count:
            break
    return cleaned


def _serialize_draft(draft: IntakeDraft) -> IntakeDraftResponse:
    return IntakeDraftResponse(
        id=draft.id,
        warehouse_id=draft.warehouse_id,
        batch_id=draft.batch_id,
        photo_url=draft.photo_url,
        status=IntakeDraftStatus(draft.status),
        position=draft.position,
        name=draft.name,
        description=draft.description,
        tags=draft.tags or [],
        aliases=draft.aliases or [],
        confidence=float(draft.confidence or 0.0),
        warnings=draft.warnings or [],
        llm_used=bool(draft.llm_used),
        error_message=draft.error_message,
        processing_attempts=draft.processing_attempts,
        created_item_id=draft.created_item_id,
        created_at=draft.created_at,
        updated_at=draft.updated_at,
    )


def _serialize_batch(batch: IntakeBatch, status_counts: dict[str, int]) -> IntakeBatchResponse:
    return IntakeBatchResponse(
        id=batch.id,
        warehouse_id=batch.warehouse_id,
        target_box_id=batch.target_box_id,
        created_by=batch.created_by,
        name=batch.name,
        status=IntakeBatchStatus(batch.status),
        total_count=batch.total_count,
        processed_count=batch.processed_count,
        committed_count=batch.committed_count,
        started_at=batch.started_at,
        finished_at=batch.finished_at,
        created_at=batch.created_at,
        updated_at=batch.updated_at,
        status_counts=status_counts,
    )


def _store_photo(request: Request, *, warehouse_id: str, file: UploadFile) -> str:
    content_type = (file.content_type or "").lower()
    ext = _ALLOWED_CONTENT_TYPES.get(content_type)
    if not ext:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image content type")

    payload = file.file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(payload) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image exceeds 10MB limit")

    warehouse_dir = Path(settings.media_root) / warehouse_id
    warehouse_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}.{ext}"
    target = warehouse_dir / filename
    target.write_bytes(payload)

    relative_url = f"{settings.media_url_path.rstrip('/')}/{warehouse_id}/{filename}"
    return f"{str(request.base_url).rstrip('/')}{relative_url}"


@router.post("/batches", response_model=IntakeBatchDetailResponse, status_code=status.HTTP_201_CREATED)
def create_batch(
    warehouse_id: str,
    payload: IntakeBatchCreateRequest,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IntakeBatchDetailResponse:
    _get_active_box(db, warehouse_id, payload.target_box_id)

    batch = IntakeBatch(
        warehouse_id=warehouse_id,
        target_box_id=payload.target_box_id,
        created_by=current_user.id,
        name=payload.name.strip() if payload.name else None,
        status=IntakeBatchStatus.drafting.value,
    )
    db.add(batch)
    db.flush()
    status_counts = refresh_batch_rollup(db, batch)
    db.commit()
    db.refresh(batch)

    return IntakeBatchDetailResponse(
        batch=_serialize_batch(batch, status_counts),
        drafts=[],
    )


@router.get("/batches/{batch_id}", response_model=IntakeBatchDetailResponse)
def get_batch(
    warehouse_id: str,
    batch_id: str,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> IntakeBatchDetailResponse:
    batch = _get_batch(db, warehouse_id, batch_id)
    drafts = db.scalars(
        select(IntakeDraft)
        .where(IntakeDraft.batch_id == batch_id, IntakeDraft.warehouse_id == warehouse_id)
        .order_by(IntakeDraft.position.asc(), IntakeDraft.created_at.asc())
    ).all()
    status_counts = resolve_batch_status_counts(db, batch.id)
    return IntakeBatchDetailResponse(
        batch=_serialize_batch(batch, status_counts),
        drafts=[_serialize_draft(draft) for draft in drafts],
    )


@router.post("/batches/{batch_id}/photos", response_model=IntakeBatchUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_batch_photos(
    request: Request,
    warehouse_id: str,
    batch_id: str,
    files: list[UploadFile] = File(...),
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> IntakeBatchUploadResponse:
    batch = _get_batch(db, warehouse_id, batch_id)
    if batch.status == IntakeBatchStatus.committed.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch already committed")

    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files provided")
    if len(files) > _MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {_MAX_FILES_PER_UPLOAD} files per upload",
        )

    max_position = db.scalar(
        select(func.coalesce(func.max(IntakeDraft.position), -1)).where(
            IntakeDraft.batch_id == batch_id,
            IntakeDraft.warehouse_id == warehouse_id,
        )
    )
    next_position = int(max_position if max_position is not None else -1) + 1

    created: list[IntakeDraft] = []
    for file in files:
        photo_url = _store_photo(request, warehouse_id=warehouse_id, file=file)
        draft = IntakeDraft(
            warehouse_id=warehouse_id,
            batch_id=batch_id,
            photo_url=photo_url,
            status=IntakeDraftStatus.uploaded.value,
            position=next_position,
            warnings=[],
        )
        next_position += 1
        db.add(draft)
        created.append(draft)

    db.flush()
    status_counts = refresh_batch_rollup(db, batch)
    db.commit()

    refreshed = db.scalars(
        select(IntakeDraft)
        .where(IntakeDraft.id.in_([draft.id for draft in created]))
        .order_by(IntakeDraft.position.asc())
    ).all()

    return IntakeBatchUploadResponse(
        batch=_serialize_batch(batch, status_counts),
        drafts=[_serialize_draft(draft) for draft in refreshed],
        uploaded_count=len(refreshed),
    )


@router.post("/batches/{batch_id}/start", response_model=IntakeBatchStartResponse)
def start_batch_processing(
    warehouse_id: str,
    batch_id: str,
    payload: IntakeBatchStartRequest,
    background_tasks: BackgroundTasks,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> IntakeBatchStartResponse:
    batch = _get_batch(db, warehouse_id, batch_id)
    if batch.status == IntakeBatchStatus.committed.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch already committed")

    if payload.retry_errors:
        error_drafts = db.scalars(
            select(IntakeDraft).where(
                IntakeDraft.batch_id == batch_id,
                IntakeDraft.warehouse_id == warehouse_id,
                IntakeDraft.status == IntakeDraftStatus.error.value,
            )
        ).all()
        for draft in error_drafts:
            draft.status = IntakeDraftStatus.uploaded.value
            draft.error_message = None
        db.flush()

    pending_count = db.scalar(
        select(func.count(IntakeDraft.id)).where(
            IntakeDraft.batch_id == batch_id,
            IntakeDraft.warehouse_id == warehouse_id,
            IntakeDraft.status == IntakeDraftStatus.uploaded.value,
        )
    )

    if not pending_count:
        status_counts = refresh_batch_rollup(db, batch)
        db.commit()
        return IntakeBatchStartResponse(
            message="No hay fotos pendientes para procesar.",
            batch=_serialize_batch(batch, status_counts),
        )

    batch.status = IntakeBatchStatus.processing.value
    if batch.started_at is None:
        batch.started_at = utcnow()
    batch.finished_at = None
    db.commit()

    background_tasks.add_task(process_intake_batch, warehouse_id=warehouse_id, batch_id=batch_id)

    status_counts = resolve_batch_status_counts(db, batch.id)
    return IntakeBatchStartResponse(
        message="Procesamiento en paralelo iniciado.",
        batch=_serialize_batch(batch, status_counts),
    )


@router.patch("/drafts/{draft_id}", response_model=IntakeDraftResponse)
def update_draft(
    warehouse_id: str,
    draft_id: str,
    payload: IntakeDraftUpdateRequest,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> IntakeDraftResponse:
    draft = _get_draft(db, warehouse_id, draft_id)

    if draft.status == IntakeDraftStatus.committed.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Draft already committed")

    changed_fields = payload.model_fields_set

    if "name" in changed_fields:
        draft.name = payload.name.strip()[:160] if payload.name else None
    if "description" in changed_fields:
        draft.description = " ".join((payload.description or "").strip().split())[:1000] or None
    if "tags" in changed_fields:
        draft.tags = _sanitize_list(payload.tags, max_count=10)
    if "aliases" in changed_fields:
        draft.aliases = _sanitize_list(payload.aliases, max_count=5)

    if payload.status is not None:
        if payload.status in {IntakeDraftStatus.processing, IntakeDraftStatus.committed}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported manual status change")
        draft.status = payload.status.value
        if payload.status == IntakeDraftStatus.uploaded:
            draft.error_message = None
            draft.warnings = []
            draft.confidence = 0.0
            draft.llm_used = False

    db.commit()
    db.refresh(draft)
    return _serialize_draft(draft)


@router.post("/batches/{batch_id}/commit", response_model=IntakeBatchCommitResponse)
def commit_batch(
    warehouse_id: str,
    batch_id: str,
    payload: IntakeBatchCommitRequest,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IntakeBatchCommitResponse:
    batch = _get_batch(db, warehouse_id, batch_id)
    _get_active_box(db, warehouse_id, batch.target_box_id)

    allowed_statuses = [IntakeDraftStatus.ready.value]
    if payload.include_review:
        allowed_statuses.append(IntakeDraftStatus.review.value)

    candidates = db.scalars(
        select(IntakeDraft)
        .where(
            IntakeDraft.batch_id == batch_id,
            IntakeDraft.warehouse_id == warehouse_id,
            IntakeDraft.status.in_(allowed_statuses),
        )
        .order_by(IntakeDraft.position.asc())
    ).all()

    created = 0
    skipped = 0

    for draft in candidates:
        if draft.created_item_id:
            skipped += 1
            draft.status = IntakeDraftStatus.committed.value
            continue

        name = (draft.name or "").strip()[:160] or "Articulo sin identificar"
        item = Item(
            warehouse_id=warehouse_id,
            box_id=batch.target_box_id,
            name=name,
            description=(draft.description or None),
            photo_url=draft.photo_url,
            physical_location=None,
            tags=draft.tags or [],
            aliases=draft.aliases or [],
        )
        db.add(item)
        db.flush()

        append_change_log(
            db,
            warehouse_id=warehouse_id,
            entity_type="item",
            entity_id=item.id,
            action="create",
            entity_version=item.version,
            payload={"name": item.name, "box_id": item.box_id},
        )

        draft.created_item_id = item.id
        draft.status = IntakeDraftStatus.committed.value
        draft.error_message = None
        created += 1

    status_counts = refresh_batch_rollup(db, batch)

    if created > 0:
        record_activity(
            db,
            warehouse_id=warehouse_id,
            actor_user_id=current_user.id,
            event_type="intake.batch.committed",
            entity_type="intake_batch",
            entity_id=batch.id,
            metadata={
                "created": created,
                "target_box_id": batch.target_box_id,
            },
        )

    db.commit()
    db.refresh(batch)

    return IntakeBatchCommitResponse(
        batch=_serialize_batch(batch, status_counts),
        created=created,
        skipped=skipped,
        errors=0,
    )


@router.delete("/batches/{batch_id}", response_model=MessageResponse)
def delete_batch(
    warehouse_id: str,
    batch_id: str,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> MessageResponse:
    batch = _get_batch(db, warehouse_id, batch_id)
    if batch.status == IntakeBatchStatus.processing.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete batch while processing")

    db.delete(batch)
    db.commit()
    return MessageResponse(message="Intake batch deleted")
