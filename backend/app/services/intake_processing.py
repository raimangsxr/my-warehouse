from __future__ import annotations

from base64 import b64encode
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
import logging
from pathlib import Path
from urllib.parse import unquote, urlparse

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.llm import normalize_model_priority
from app.db.session import SessionLocal
from app.models.intake_batch import IntakeBatch
from app.models.intake_draft import IntakeDraft
from app.models.llm_setting import LLMSetting
from app.schemas.intake import IntakeBatchStatus, IntakeDraftStatus
from app.services.llm_enrichment import generate_item_draft_from_photo
from app.services.secret_store import decrypt_secret

logger = logging.getLogger(__name__)

DEFAULT_PARALLEL_WORKERS = 4
MAX_PARALLEL_WORKERS = 8
_MAX_IMAGE_BYTES = 10 * 1024 * 1024
_ALLOWED_SUFFIX_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
}


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def resolve_batch_status_counts(db: Session, batch_id: str) -> dict[str, int]:
    rows = db.execute(
        select(IntakeDraft.status, func.count())
        .where(IntakeDraft.batch_id == batch_id)
        .group_by(IntakeDraft.status)
    ).all()
    return {status: int(count) for status, count in rows}


def refresh_batch_rollup(db: Session, batch: IntakeBatch) -> dict[str, int]:
    counts = resolve_batch_status_counts(db, batch.id)

    total = sum(counts.values())
    uploaded_count = counts.get(IntakeDraftStatus.uploaded.value, 0)
    processing_count = counts.get(IntakeDraftStatus.processing.value, 0)
    committed_count = counts.get(IntakeDraftStatus.committed.value, 0)

    batch.total_count = total
    batch.processed_count = max(total - uploaded_count - processing_count, 0)
    batch.committed_count = committed_count

    if processing_count > 0:
        batch.status = IntakeBatchStatus.processing.value
        batch.finished_at = None
    elif total > 0 and committed_count == total:
        batch.status = IntakeBatchStatus.committed.value
        batch.finished_at = utcnow()
    elif total == 0 or uploaded_count > 0:
        batch.status = IntakeBatchStatus.drafting.value
        batch.finished_at = None
    else:
        batch.status = IntakeBatchStatus.review.value
        batch.finished_at = utcnow()

    return counts


def resolve_parallel_worker_count(requested_workers: int | None) -> int:
    if requested_workers is None:
        requested_workers = DEFAULT_PARALLEL_WORKERS
    return max(1, min(int(requested_workers), MAX_PARALLEL_WORKERS))


def resolve_intake_parallelism_for_warehouse(db: Session, warehouse_id: str) -> int:
    setting = db.scalar(select(LLMSetting).where(LLMSetting.warehouse_id == warehouse_id))
    if setting is None:
        return DEFAULT_PARALLEL_WORKERS
    return resolve_parallel_worker_count(getattr(setting, "intake_parallelism", DEFAULT_PARALLEL_WORKERS))


def process_intake_batch(
    warehouse_id: str,
    batch_id: str,
    *,
    max_parallel_workers: int = DEFAULT_PARALLEL_WORKERS,
    draft_ids: list[str] | None = None,
    context_name_overrides: dict[str, str | None] | None = None,
) -> int:
    workers_limit = resolve_parallel_worker_count(max_parallel_workers)
    logger.info(
        "Intake worker started warehouse_id=%s batch_id=%s max_parallel_workers=%s draft_filter=%s",
        warehouse_id,
        batch_id,
        workers_limit,
        len(draft_ids) if draft_ids else 0,
    )
    db = SessionLocal()
    try:
        batch = db.scalar(
            select(IntakeBatch).where(IntakeBatch.id == batch_id, IntakeBatch.warehouse_id == warehouse_id)
        )
        if batch is None:
            logger.error("Intake worker aborted: batch not found warehouse_id=%s batch_id=%s", warehouse_id, batch_id)
            return 0

        query = (
            select(IntakeDraft)
            .where(
                IntakeDraft.batch_id == batch_id,
                IntakeDraft.warehouse_id == warehouse_id,
                IntakeDraft.status == IntakeDraftStatus.uploaded.value,
            )
            .order_by(IntakeDraft.position.asc(), IntakeDraft.created_at.asc())
        )
        if draft_ids:
            query = query.where(IntakeDraft.id.in_(draft_ids))
        pending = db.scalars(query).all()

        if not pending:
            refresh_batch_rollup(db, batch)
            db.commit()
            logger.debug(
                "Intake worker no pending drafts warehouse_id=%s batch_id=%s",
                warehouse_id,
                batch_id,
            )
            return 0

        for draft in pending:
            draft.status = IntakeDraftStatus.processing.value
            draft.processing_attempts += 1
            draft.error_message = None
        if batch.started_at is None:
            batch.started_at = utcnow()
        batch.status = IntakeBatchStatus.processing.value
        batch.finished_at = None
        db.commit()

        llm_setting = db.scalar(select(LLMSetting).where(LLMSetting.warehouse_id == warehouse_id))
        api_key: str | None = None
        output_language = "es"
        model_priority: list[str] | None = None
        if llm_setting is not None:
            output_language = llm_setting.language or "es"
            model_priority = normalize_model_priority(llm_setting.model_priority)
            if llm_setting.api_key_encrypted:
                try:
                    api_key = decrypt_secret(llm_setting.api_key_encrypted)
                except Exception:  # noqa: BLE001
                    logger.error("Could not decrypt LLM API key for warehouse %s", warehouse_id)
        logger.debug(
            "Intake worker config warehouse_id=%s batch_id=%s pending=%s workers=%s language=%s",
            warehouse_id,
            batch_id,
            len(pending),
            max(1, min(workers_limit, len(pending), MAX_PARALLEL_WORKERS)),
            output_language,
        )

        jobs = [
            {
                "draft_id": draft.id,
                "photo_url": draft.photo_url,
                "current_name": draft.name,
                "suggested_name": draft.suggested_name,
            }
            for draft in pending
        ]
        context_by_draft_id: dict[str, dict[str, str | None]] = {}
        for job in jobs:
            draft_id = str(job["draft_id"])
            if context_name_overrides is not None and draft_id in context_name_overrides:
                name_context = context_name_overrides[draft_id]
            else:
                name_context = _resolve_name_context(
                    current_name=job.get("current_name"),
                    suggested_name=job.get("suggested_name"),
                )
            context_by_draft_id[draft_id] = {"name_context": name_context}

        workers = max(1, min(workers_limit, len(jobs), MAX_PARALLEL_WORKERS))
        results: dict[str, dict[str, object]] = {}

        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_map = {
                executor.submit(
                    _process_photo_url,
                    warehouse_id=warehouse_id,
                    photo_url=job["photo_url"],
                    api_key=api_key,
                    output_language=output_language,
                    model_priority=model_priority,
                    context_name=context_by_draft_id.get(str(job["draft_id"]), {}).get("name_context"),
                    context_description=None,
                ): job["draft_id"]
                for job in jobs
            }

            for future in as_completed(future_map):
                draft_id = future_map[future]
                try:
                    results[draft_id] = future.result()
                except Exception as exc:  # noqa: BLE001
                    logger.exception("Unexpected processing failure for draft %s", draft_id)
                    results[draft_id] = {
                        "error": f"Error inesperado de procesamiento: {str(exc)[:220]}"
                    }

        processed_drafts = db.scalars(
            select(IntakeDraft).where(
                IntakeDraft.id.in_(list(results.keys())),
                IntakeDraft.batch_id == batch_id,
                IntakeDraft.warehouse_id == warehouse_id,
            )
        ).all()

        success_count = 0
        error_count = 0
        for draft in processed_drafts:
            payload = results.get(draft.id, {})
            context = context_by_draft_id.get(draft.id, {})
            context_name = context.get("name_context")
            error_text = str(payload.get("error") or "").strip()
            if error_text:
                draft.status = IntakeDraftStatus.error.value
                draft.error_message = error_text[:500]
                draft.warnings = []
                draft.llm_used = False
                draft.confidence = 0.0
                error_count += 1
                continue

            payload_name = _normalize_optional_text(payload.get("name"), max_len=160)
            # In manual retry, user-edited title is authoritative and should not be replaced by model output.
            draft.name = context_name or payload_name or "Articulo sin identificar"
            if payload_name:
                if not context_name:
                    draft.suggested_name = payload_name
                elif not draft.suggested_name:
                    draft.suggested_name = payload_name
            raw_description = payload.get("description")
            payload_description = _normalize_optional_text(raw_description, max_len=1000)
            draft.description = payload_description or draft.description
            draft.tags = [str(tag) for tag in (payload.get("tags") or [])][:10]
            draft.aliases = [str(alias) for alias in (payload.get("aliases") or [])][:5]
            draft.confidence = float(payload.get("confidence") or 0.0)
            draft.warnings = [str(w) for w in (payload.get("warnings") or [])][:5]
            draft.llm_used = bool(payload.get("llm_used"))
            draft.error_message = None
            draft.status = _resolve_draft_result_status()
            success_count += 1

        refresh_batch_rollup(db, batch)
        db.commit()
        logger.info(
            "Intake worker completed warehouse_id=%s batch_id=%s success=%s errors=%s total=%s",
            warehouse_id,
            batch_id,
            success_count,
            error_count,
            len(processed_drafts),
        )
        return len(processed_drafts)
    finally:
        db.close()


def _resolve_draft_result_status() -> str:
    return IntakeDraftStatus.ready.value


def _normalize_optional_text(raw: object, *, max_len: int) -> str | None:
    normalized = " ".join(str(raw or "").strip().split())
    if not normalized:
        return None
    return normalized[:max_len]


def _normalize_compare_text(raw: object) -> str:
    return " ".join(str(raw or "").strip().split()).lower()


def _resolve_name_context(*, current_name: object, suggested_name: object) -> str | None:
    current = _normalize_optional_text(current_name, max_len=160)
    if not current:
        return None
    suggested = _normalize_optional_text(suggested_name, max_len=160)
    if not suggested:
        return None
    if _normalize_compare_text(current) == _normalize_compare_text(suggested):
        return None
    return current


def _process_photo_url(
    *,
    warehouse_id: str,
    photo_url: str,
    api_key: str | None,
    output_language: str,
    model_priority: list[str] | None,
    context_name: str | None,
    context_description: str | None,
) -> dict[str, object]:
    if not api_key:
        logger.debug("Skipping draft processing without API key warehouse_id=%s", warehouse_id)
        return {"error": "No hay API key de IA configurada para procesar el lote."}

    try:
        image_data_url = _build_data_url_from_photo_url(photo_url, warehouse_id=warehouse_id)
    except ValueError as exc:
        logger.error("Draft processing rejected warehouse_id=%s reason=%s", warehouse_id, exc)
        return {"error": str(exc)}

    try:
        draft = generate_item_draft_from_photo(
            image_data_url,
            api_key=api_key,
            output_language=output_language,
            model_priority=model_priority,
            context_name=context_name,
            context_description=context_description,
        )
        if not bool(draft.get("llm_used")):
            logger.debug("Draft processing returned llm_used=false warehouse_id=%s", warehouse_id)
            return {"error": "No se pudo completar el analisis del articulo con IA."}
        return draft
    except ValueError as exc:
        return {"error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        logger.error("LLM processing failed for %s: %s", photo_url, exc)
        return {"error": "No se pudo completar el analisis de la imagen."}


def _build_data_url_from_photo_url(photo_url: str, *, warehouse_id: str) -> str:
    parsed = urlparse(photo_url)
    raw_path = unquote(parsed.path or "")
    media_url_path = settings.media_url_path.rstrip("/")
    expected_prefix = f"{media_url_path}/{warehouse_id}/"
    if not raw_path.startswith(expected_prefix):
        raise ValueError("La foto no pertenece al warehouse activo.")

    relative_path = raw_path[len(expected_prefix) :]
    if not relative_path:
        raise ValueError("Ruta de foto invalida.")

    warehouse_root = (Path(settings.media_root) / warehouse_id).resolve()
    file_path = (warehouse_root / relative_path).resolve()
    if warehouse_root not in file_path.parents:
        raise ValueError("Ruta de foto fuera del storage permitido.")
    if not file_path.exists() or not file_path.is_file():
        raise ValueError("No se encontro la foto en el storage del servidor.")

    mime = _ALLOWED_SUFFIX_MIME.get(file_path.suffix.lower())
    if not mime:
        raise ValueError("Tipo de imagen no soportado para analisis.")

    payload = file_path.read_bytes()
    if not payload:
        raise ValueError("La imagen esta vacia.")
    if len(payload) > _MAX_IMAGE_BYTES:
        raise ValueError("La imagen supera el limite de 10MB.")

    encoded = b64encode(payload).decode("ascii")
    return f"data:{mime};base64,{encoded}"
