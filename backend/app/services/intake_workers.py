from __future__ import annotations

from dataclasses import dataclass, field
import logging
import threading
import time

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.intake_draft import IntakeDraft
from app.schemas.intake import IntakeDraftStatus
from app.services.intake_processing import process_intake_batch, resolve_parallel_worker_count

logger = logging.getLogger(__name__)

_BATCH_IDLE_WAIT_SECONDS = 1.0
_WORKERS_LOCK = threading.Lock()
_ACTIVE_WORKERS: dict[str, "BatchWorkerHandle"] = {}


@dataclass
class BatchWorkerHandle:
    warehouse_id: str
    batch_id: str
    max_parallel_workers: int
    initial_draft_ids: list[str] | None = None
    initial_context_name_overrides: dict[str, str | None] | None = None
    stop_requested: bool = False
    wakeup_event: threading.Event = field(default_factory=threading.Event)
    thread: threading.Thread | None = None


def ensure_batch_worker(
    warehouse_id: str,
    batch_id: str,
    *,
    max_parallel_workers: int,
    draft_ids: list[str] | None = None,
    context_name_overrides: dict[str, str | None] | None = None,
) -> bool:
    worker_key = _worker_key(warehouse_id=warehouse_id, batch_id=batch_id)
    requested_workers = resolve_parallel_worker_count(max_parallel_workers)

    with _WORKERS_LOCK:
        existing = _ACTIVE_WORKERS.get(worker_key)
        if existing is not None and existing.thread is not None and existing.thread.is_alive():
            existing.max_parallel_workers = requested_workers
            existing.wakeup_event.set()
            logger.debug(
                "Intake batch worker already active warehouse_id=%s batch_id=%s workers=%s",
                warehouse_id,
                batch_id,
                requested_workers,
            )
            return False

        handle = BatchWorkerHandle(
            warehouse_id=warehouse_id,
            batch_id=batch_id,
            max_parallel_workers=requested_workers,
            initial_draft_ids=list(draft_ids) if draft_ids else None,
            initial_context_name_overrides=dict(context_name_overrides) if context_name_overrides else None,
        )
        thread = threading.Thread(
            target=_run_worker_loop,
            args=(worker_key, handle),
            daemon=True,
            name=f"intake-batch-{batch_id[:8]}",
        )
        handle.thread = thread
        _ACTIVE_WORKERS[worker_key] = handle

    thread.start()
    logger.info(
        "Intake batch worker registered warehouse_id=%s batch_id=%s workers=%s scoped=%s",
        warehouse_id,
        batch_id,
        requested_workers,
        len(draft_ids) if draft_ids else 0,
    )
    return True


def shutdown_batch_workers(*, timeout_seconds: float = 5.0) -> None:
    with _WORKERS_LOCK:
        handles = list(_ACTIVE_WORKERS.values())

    deadline = time.monotonic() + max(timeout_seconds, 0.0)
    for handle in handles:
        handle.stop_requested = True
        handle.wakeup_event.set()
        remaining = max(0.0, deadline - time.monotonic())
        if handle.thread is not None and handle.thread.is_alive():
            handle.thread.join(timeout=remaining)


def _run_worker_loop(worker_key: str, handle: BatchWorkerHandle) -> None:
    draft_ids = list(handle.initial_draft_ids) if handle.initial_draft_ids else None
    context_name_overrides = (
        dict(handle.initial_context_name_overrides) if handle.initial_context_name_overrides else None
    )
    scoped_only = draft_ids is not None
    try:
        while True:
            if handle.stop_requested:
                break
            handle.wakeup_event.clear()
            processed_count = process_intake_batch(
                handle.warehouse_id,
                handle.batch_id,
                max_parallel_workers=handle.max_parallel_workers,
                draft_ids=draft_ids,
                context_name_overrides=context_name_overrides,
            )
            if scoped_only:
                break
            draft_ids = None
            context_name_overrides = None

            if processed_count > 0:
                continue

            if handle.stop_requested:
                break

            if handle.wakeup_event.wait(timeout=_BATCH_IDLE_WAIT_SECONDS):
                continue

            if handle.stop_requested:
                break

            if _batch_has_uploaded_drafts(handle.warehouse_id, handle.batch_id):
                continue

            logger.debug(
                "Intake batch worker idle exit warehouse_id=%s batch_id=%s",
                handle.warehouse_id,
                handle.batch_id,
            )
            break
    finally:
        with _WORKERS_LOCK:
            current = _ACTIVE_WORKERS.get(worker_key)
            if current is handle:
                _ACTIVE_WORKERS.pop(worker_key, None)


def _batch_has_uploaded_drafts(warehouse_id: str, batch_id: str) -> bool:
    db = SessionLocal()
    try:
        draft = db.scalar(
            select(IntakeDraft.id).where(
                IntakeDraft.warehouse_id == warehouse_id,
                IntakeDraft.batch_id == batch_id,
                IntakeDraft.status == IntakeDraftStatus.uploaded.value,
            )
        )
        return draft is not None
    finally:
        db.close()


def _worker_key(*, warehouse_id: str, batch_id: str) -> str:
    return f"{warehouse_id}:{batch_id}"
