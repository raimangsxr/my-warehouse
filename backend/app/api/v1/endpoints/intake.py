from __future__ import annotations

from datetime import UTC, datetime
import logging
from pathlib import Path
import shutil
import uuid
from urllib.parse import unquote, urlsplit, urlunsplit

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Request, UploadFile, status
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
    IntakeDraftReprocessMode,
    IntakeDraftReprocessRequest,
    IntakeDraftResponse,
    IntakeDraftStatus,
    IntakeDraftUpdateRequest,
)
from app.services.activity import record_activity
from app.services.intake_processing import (
    DEFAULT_PARALLEL_WORKERS,
    process_intake_batch,
    refresh_batch_rollup,
    resolve_batch_status_counts,
)
from app.services.stock import ensure_initial_stock_movement
from app.services.sync_log import append_change_log

router = APIRouter(prefix="/warehouses/{warehouse_id}/intake", tags=["intake"])
logger = logging.getLogger(__name__)

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


def _resolve_status_counts_for_batches(db: Session, batch_ids: list[str]) -> dict[str, dict[str, int]]:
    if not batch_ids:
        return {}

    counts_by_batch: dict[str, dict[str, int]] = {batch_id: {} for batch_id in batch_ids}
    rows = db.execute(
        select(IntakeDraft.batch_id, IntakeDraft.status, func.count(IntakeDraft.id))
        .where(IntakeDraft.batch_id.in_(batch_ids))
        .group_by(IntakeDraft.batch_id, IntakeDraft.status)
    ).all()

    for batch_id, status_value, total in rows:
        counts_by_batch[str(batch_id)][str(status_value)] = int(total)

    return counts_by_batch


def _store_batch_photo(request: Request, *, warehouse_id: str, batch_id: str, file: UploadFile) -> str:
    content_type = (file.content_type or "").lower()
    ext = _ALLOWED_CONTENT_TYPES.get(content_type)
    if not ext:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image content type")

    payload = file.file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(payload) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image exceeds 10MB limit")

    batch_dir = Path(settings.media_root) / warehouse_id / "intake" / batch_id
    batch_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}.{ext}"
    target = batch_dir / filename
    target.write_bytes(payload)

    relative_url = f"{settings.media_url_path.rstrip('/')}/{warehouse_id}/intake/{batch_id}/{filename}"
    logger.debug(
        "Stored intake photo warehouse_id=%s batch_id=%s filename=%s bytes=%s",
        warehouse_id,
        batch_id,
        filename,
        len(payload),
    )
    return f"{str(request.base_url).rstrip('/')}{relative_url}"


def _resolve_media_file_from_url(photo_url: str, *, warehouse_id: str) -> Path:
    parsed = urlsplit(photo_url)
    raw_path = unquote(parsed.path or "")
    media_url_path = settings.media_url_path.rstrip("/")
    expected_prefix = f"{media_url_path}/{warehouse_id}/"
    if not raw_path.startswith(expected_prefix):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Draft photo is outside current warehouse media")

    relative_path = raw_path[len(expected_prefix) :]
    if not relative_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid draft photo path")

    warehouse_root = (Path(settings.media_root) / warehouse_id).resolve()
    file_path = (warehouse_root / relative_path).resolve()
    if warehouse_root not in file_path.parents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid draft photo path")
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Draft photo file not found")
    return file_path


def _move_draft_photo_to_items_storage(*, warehouse_id: str, photo_url: str) -> str:
    src_file = _resolve_media_file_from_url(photo_url, warehouse_id=warehouse_id)
    items_root = Path(settings.media_root) / warehouse_id / "items"
    items_root.mkdir(parents=True, exist_ok=True)

    suffix = src_file.suffix.lower()
    filename = f"{uuid.uuid4()}{suffix}" if suffix else str(uuid.uuid4())
    target = items_root / filename
    shutil.move(str(src_file), str(target))

    parsed = urlsplit(photo_url)
    new_relative = f"{settings.media_url_path.rstrip('/')}/{warehouse_id}/items/{filename}"
    logger.debug("Moved intake photo to item storage warehouse_id=%s filename=%s", warehouse_id, filename)
    return urlunsplit((parsed.scheme, parsed.netloc, new_relative, "", ""))


def _cleanup_batch_media_dir(*, warehouse_id: str, batch_id: str) -> None:
    batch_dir = Path(settings.media_root) / warehouse_id / "intake" / batch_id
    if batch_dir.exists():
        shutil.rmtree(batch_dir, ignore_errors=True)
        logger.debug("Cleaned intake batch media directory warehouse_id=%s batch_id=%s", warehouse_id, batch_id)

    intake_root = Path(settings.media_root) / warehouse_id / "intake"
    if intake_root.exists():
        try:
            intake_root.rmdir()
        except OSError:
            pass


def _cleanup_empty_batch_dirs(*, warehouse_id: str, batch_id: str) -> None:
    batch_dir = Path(settings.media_root) / warehouse_id / "intake" / batch_id
    if batch_dir.exists():
        try:
            batch_dir.rmdir()
        except OSError:
            pass

    intake_root = Path(settings.media_root) / warehouse_id / "intake"
    if intake_root.exists():
        try:
            intake_root.rmdir()
        except OSError:
            pass


def _cleanup_draft_temp_photo_file(*, warehouse_id: str, batch_id: str, photo_url: str) -> None:
    parsed = urlsplit(photo_url)
    raw_path = unquote(parsed.path or "")
    media_url_path = settings.media_url_path.rstrip("/")
    expected_prefix = f"{media_url_path}/{warehouse_id}/intake/{batch_id}/"
    if not raw_path.startswith(expected_prefix):
        return

    relative_path = raw_path[len(f"{media_url_path}/{warehouse_id}/") :]
    if not relative_path:
        return

    warehouse_root = (Path(settings.media_root) / warehouse_id).resolve()
    file_path = (warehouse_root / relative_path).resolve()
    if warehouse_root not in file_path.parents:
        return
    if file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
        except OSError:
            pass

    _cleanup_empty_batch_dirs(warehouse_id=warehouse_id, batch_id=batch_id)


def _normalize_optional_text(raw: object, *, max_len: int) -> str | None:
    normalized = " ".join(str(raw or "").strip().split())
    if not normalized:
        return None
    return normalized[:max_len]


@router.get("/batches", response_model=list[IntakeBatchResponse])
def list_batches(
    warehouse_id: str,
    include_committed: bool = Query(default=False),
    only_mine: bool = Query(default=True),
    limit: int = Query(default=20, ge=1, le=100),
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[IntakeBatchResponse]:
    logger.debug(
        "List intake batches requested warehouse_id=%s user_id=%s include_committed=%s only_mine=%s limit=%s",
        warehouse_id,
        current_user.id,
        include_committed,
        only_mine,
        limit,
    )
    query = select(IntakeBatch).where(IntakeBatch.warehouse_id == warehouse_id)

    if only_mine:
        query = query.where(IntakeBatch.created_by == current_user.id)
    if not include_committed:
        query = query.where(IntakeBatch.status != IntakeBatchStatus.committed.value)

    batches = db.scalars(query.order_by(IntakeBatch.updated_at.desc()).limit(limit)).all()
    batch_ids = [batch.id for batch in batches]
    counts_by_batch = _resolve_status_counts_for_batches(db, batch_ids)

    response = [_serialize_batch(batch, counts_by_batch.get(batch.id, {})) for batch in batches]
    logger.debug(
        "List intake batches completed warehouse_id=%s user_id=%s count=%s",
        warehouse_id,
        current_user.id,
        len(response),
    )
    return response


@router.post("/batches", response_model=IntakeBatchDetailResponse, status_code=status.HTTP_201_CREATED)
def create_batch(
    warehouse_id: str,
    payload: IntakeBatchCreateRequest,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IntakeBatchDetailResponse:
    logger.debug(
        "Create intake batch requested warehouse_id=%s user_id=%s target_box_id=%s name=%s",
        warehouse_id,
        current_user.id,
        payload.target_box_id,
        payload.name,
    )
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
    logger.info(
        "Intake batch created warehouse_id=%s batch_id=%s target_box_id=%s created_by=%s",
        warehouse_id,
        batch.id,
        batch.target_box_id,
        current_user.id,
    )

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
    logger.debug(
        "Get intake batch requested warehouse_id=%s batch_id=%s drafts=%s",
        warehouse_id,
        batch_id,
        len(drafts),
    )
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
    logger.debug(
        "Upload intake photos requested warehouse_id=%s batch_id=%s files=%s",
        warehouse_id,
        batch_id,
        len(files) if files else 0,
    )
    batch = _get_batch(db, warehouse_id, batch_id)

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
        photo_url = _store_batch_photo(request, warehouse_id=warehouse_id, batch_id=batch_id, file=file)
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
    logger.info(
        "Intake photos uploaded warehouse_id=%s batch_id=%s uploaded=%s batch_status=%s",
        warehouse_id,
        batch_id,
        len(refreshed),
        batch.status,
    )

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
    logger.debug(
        "Start intake processing requested warehouse_id=%s batch_id=%s retry_errors=%s",
        warehouse_id,
        batch_id,
        payload.retry_errors,
    )
    batch = _get_batch(db, warehouse_id, batch_id)
    if batch.status == IntakeBatchStatus.committed.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch already committed")

    draft_ids_to_process: list[str] | None = None
    max_parallel_workers = DEFAULT_PARALLEL_WORKERS

    if payload.retry_errors:
        error_drafts = db.scalars(
            select(IntakeDraft).where(
                IntakeDraft.batch_id == batch_id,
                IntakeDraft.warehouse_id == warehouse_id,
                IntakeDraft.status == IntakeDraftStatus.error.value,
            )
            .order_by(IntakeDraft.position.asc(), IntakeDraft.created_at.asc())
        ).all()
        draft_ids_to_process = [draft.id for draft in error_drafts]
        for draft in error_drafts:
            draft.status = IntakeDraftStatus.uploaded.value
            draft.error_message = None
        db.flush()
        max_parallel_workers = 1

    pending_query = select(func.count(IntakeDraft.id)).where(
        IntakeDraft.batch_id == batch_id,
        IntakeDraft.warehouse_id == warehouse_id,
        IntakeDraft.status == IntakeDraftStatus.uploaded.value,
    )
    if draft_ids_to_process:
        pending_query = pending_query.where(IntakeDraft.id.in_(draft_ids_to_process))

    pending_count = db.scalar(pending_query)

    if payload.retry_errors and not draft_ids_to_process:
        status_counts = refresh_batch_rollup(db, batch)
        db.commit()
        logger.debug(
            "Start intake processing skipped: no drafts in error warehouse_id=%s batch_id=%s",
            warehouse_id,
            batch_id,
        )
        return IntakeBatchStartResponse(
            message="No hay articulos en error para reprocesar.",
            batch=_serialize_batch(batch, status_counts),
        )

    if not pending_count:
        status_counts = refresh_batch_rollup(db, batch)
        db.commit()
        logger.debug(
            "Start intake processing skipped: no pending drafts warehouse_id=%s batch_id=%s",
            warehouse_id,
            batch_id,
        )
        return IntakeBatchStartResponse(
            message="No hay fotos pendientes para procesar.",
            batch=_serialize_batch(batch, status_counts),
        )

    batch.status = IntakeBatchStatus.processing.value
    if batch.started_at is None:
        batch.started_at = utcnow()
    batch.finished_at = None
    db.commit()

    background_tasks.add_task(
        process_intake_batch,
        warehouse_id=warehouse_id,
        batch_id=batch_id,
        max_parallel_workers=max_parallel_workers,
        draft_ids=draft_ids_to_process,
    )

    status_counts = resolve_batch_status_counts(db, batch.id)
    success_message = "Reprocesado secuencial de errores iniciado." if payload.retry_errors else "Procesamiento iniciado."
    logger.info(
        "Intake processing started warehouse_id=%s batch_id=%s pending=%s workers=%s retry_errors=%s",
        warehouse_id,
        batch_id,
        int(pending_count or 0),
        max_parallel_workers,
        payload.retry_errors,
    )
    return IntakeBatchStartResponse(
        message=success_message,
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
    logger.debug(
        "Update intake draft requested warehouse_id=%s draft_id=%s fields=%s",
        warehouse_id,
        draft_id,
        sorted(payload.model_fields_set),
    )
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
    logger.info(
        "Intake draft updated warehouse_id=%s draft_id=%s status=%s",
        warehouse_id,
        draft.id,
        draft.status,
    )
    return _serialize_draft(draft)


@router.post("/drafts/{draft_id}/reprocess", response_model=IntakeBatchStartResponse)
def reprocess_draft(
    warehouse_id: str,
    draft_id: str,
    payload: IntakeDraftReprocessRequest,
    background_tasks: BackgroundTasks,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> IntakeBatchStartResponse:
    logger.debug(
        "Reprocess intake draft requested warehouse_id=%s draft_id=%s mode=%s",
        warehouse_id,
        draft_id,
        payload.mode.value,
    )
    draft = _get_draft(db, warehouse_id, draft_id)
    if draft.status == IntakeDraftStatus.committed.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Draft already committed")

    batch = _get_batch(db, warehouse_id, draft.batch_id)
    if batch.status == IntakeBatchStatus.committed.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch already committed")
    if batch.status == IntakeBatchStatus.processing.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch is currently processing")

    normalized_name = _normalize_optional_text(draft.name, max_len=160)
    context_override: str | None = None
    if payload.mode == IntakeDraftReprocessMode.name:
        if not normalized_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Draft name is required for name-based reprocess",
            )
        draft.name = normalized_name
        draft.suggested_name = f"__name_ctx__{uuid.uuid4().hex}"
        context_override = normalized_name
    else:
        if normalized_name:
            # Force photo-only run: suppress name context by aligning suggestion with current title.
            draft.suggested_name = normalized_name
        context_override = None

    draft.status = IntakeDraftStatus.uploaded.value
    draft.error_message = None
    draft.warnings = []
    draft.confidence = 0.0
    draft.llm_used = False
    db.flush()

    batch.status = IntakeBatchStatus.processing.value
    if batch.started_at is None:
        batch.started_at = utcnow()
    batch.finished_at = None
    db.commit()

    background_tasks.add_task(
        process_intake_batch,
        warehouse_id=warehouse_id,
        batch_id=batch.id,
        max_parallel_workers=1,
        draft_ids=[draft.id],
        context_name_overrides={draft.id: context_override},
    )

    status_counts = resolve_batch_status_counts(db, batch.id)
    message = (
        "Reprocesado del articulo iniciado (contexto por titulo)."
        if payload.mode == IntakeDraftReprocessMode.name
        else "Reprocesado del articulo iniciado (solo foto)."
    )
    logger.info(
        "Intake draft reprocess started warehouse_id=%s batch_id=%s draft_id=%s mode=%s",
        warehouse_id,
        batch.id,
        draft.id,
        payload.mode.value,
    )
    return IntakeBatchStartResponse(
        message=message,
        batch=_serialize_batch(batch, status_counts),
    )


@router.delete("/drafts/{draft_id}", response_model=MessageResponse)
def delete_draft(
    warehouse_id: str,
    draft_id: str,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> MessageResponse:
    logger.debug("Delete intake draft requested warehouse_id=%s draft_id=%s", warehouse_id, draft_id)
    draft = _get_draft(db, warehouse_id, draft_id)
    batch = _get_batch(db, warehouse_id, draft.batch_id)
    if batch.status == IntakeBatchStatus.processing.value or draft.status == IntakeDraftStatus.processing.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete draft while batch is processing")
    draft_photo_url = draft.photo_url

    db.delete(draft)
    refresh_batch_rollup(db, batch)
    db.commit()
    _cleanup_draft_temp_photo_file(
        warehouse_id=warehouse_id,
        batch_id=batch.id,
        photo_url=draft_photo_url,
    )
    if batch.status == IntakeBatchStatus.committed.value:
        _cleanup_batch_media_dir(warehouse_id=warehouse_id, batch_id=batch.id)

    logger.info(
        "Intake draft deleted warehouse_id=%s batch_id=%s draft_id=%s",
        warehouse_id,
        batch.id,
        draft_id,
    )
    return MessageResponse(message="Intake draft deleted")


@router.post("/batches/{batch_id}/commit", response_model=IntakeBatchCommitResponse)
def commit_batch(
    warehouse_id: str,
    batch_id: str,
    payload: IntakeBatchCommitRequest,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IntakeBatchCommitResponse:
    logger.info(
        "Commit intake batch requested warehouse_id=%s batch_id=%s user_id=%s include_review=%s",
        warehouse_id,
        batch_id,
        current_user.id,
        payload.include_review,
    )
    batch = _get_batch(db, warehouse_id, batch_id)
    _get_active_box(db, warehouse_id, batch.target_box_id)

    candidates = db.scalars(
        select(IntakeDraft)
        .where(
            IntakeDraft.batch_id == batch_id,
            IntakeDraft.warehouse_id == warehouse_id,
            IntakeDraft.status == IntakeDraftStatus.ready.value,
        )
        .order_by(IntakeDraft.position.asc())
    ).all()

    created = 0
    skipped = 0
    errors = 0

    for draft in candidates:
        if draft.created_item_id:
            skipped += 1
            draft.status = IntakeDraftStatus.committed.value
            continue

        name = (draft.name or "").strip()[:160] or "Articulo sin identificar"
        try:
            item_photo_url = _move_draft_photo_to_items_storage(warehouse_id=warehouse_id, photo_url=draft.photo_url)
        except HTTPException:
            draft.status = IntakeDraftStatus.error.value
            draft.error_message = "No se pudo mover la imagen temporal al storage definitivo."
            errors += 1
            continue

        item = Item(
            warehouse_id=warehouse_id,
            box_id=batch.target_box_id,
            name=name,
            description=(draft.description or None),
            photo_url=item_photo_url,
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
        initial_stock_command_id, created_initial_stock = ensure_initial_stock_movement(
            db,
            warehouse_id=warehouse_id,
            item_id=item.id,
        )
        if created_initial_stock:
            append_change_log(
                db,
                warehouse_id=warehouse_id,
                entity_type="stock",
                entity_id=item.id,
                action="adjust",
                payload={"delta": 1, "command_id": initial_stock_command_id},
            )

        draft.created_item_id = item.id
        draft.photo_url = item_photo_url
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
    if batch.status == IntakeBatchStatus.committed.value:
        _cleanup_batch_media_dir(warehouse_id=warehouse_id, batch_id=batch.id)

    logger.info(
        "Commit intake batch completed warehouse_id=%s batch_id=%s created=%s skipped=%s errors=%s",
        warehouse_id,
        batch_id,
        created,
        skipped,
        errors,
    )
    return IntakeBatchCommitResponse(
        batch=_serialize_batch(batch, status_counts),
        created=created,
        skipped=skipped,
        errors=errors,
    )


@router.delete("/batches/{batch_id}", response_model=MessageResponse)
def delete_batch(
    warehouse_id: str,
    batch_id: str,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> MessageResponse:
    logger.debug("Delete intake batch requested warehouse_id=%s batch_id=%s", warehouse_id, batch_id)
    batch = _get_batch(db, warehouse_id, batch_id)
    if batch.status == IntakeBatchStatus.processing.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete batch while processing")

    db.delete(batch)
    db.commit()
    _cleanup_batch_media_dir(warehouse_id=warehouse_id, batch_id=batch_id)
    logger.info("Intake batch deleted warehouse_id=%s batch_id=%s", warehouse_id, batch_id)
    return MessageResponse(message="Intake batch deleted")
