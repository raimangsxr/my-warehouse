from __future__ import annotations

import logging
import threading

from app.db.session import SessionLocal
from app.services.reorganization import run_analysis

logger = logging.getLogger(__name__)

_REORG_WORKERS_LOCK = threading.Lock()
_ACTIVE_REORG_WORKERS: dict[str, threading.Thread] = {}


def start_reorganization_worker(session_id: str, warehouse_id: str) -> None:
    """
    Launch a daemon thread that calls run_analysis().

    If a thread is already active for session_id, no new thread is launched.
    On completion (success or error), the entry is removed from the dict.
    """
    with _REORG_WORKERS_LOCK:
        existing = _ACTIVE_REORG_WORKERS.get(session_id)
        if existing is not None and existing.is_alive():
            logger.debug(
                "Reorganization worker already active session_id=%s warehouse_id=%s",
                session_id,
                warehouse_id,
            )
            return

        thread = threading.Thread(
            target=_run_worker,
            args=(session_id, warehouse_id),
            daemon=True,
            name=f"reorg-{session_id[:8]}",
        )
        _ACTIVE_REORG_WORKERS[session_id] = thread

    thread.start()
    logger.info(
        "Reorganization worker started session_id=%s warehouse_id=%s",
        session_id,
        warehouse_id,
    )


def _run_worker(session_id: str, warehouse_id: str) -> None:
    db = SessionLocal()
    try:
        run_analysis(session_id, warehouse_id, db)
    except Exception:  # noqa: BLE001
        logger.exception(
            "Reorganization worker unhandled error session_id=%s warehouse_id=%s",
            session_id,
            warehouse_id,
        )
    finally:
        db.close()
        with _REORG_WORKERS_LOCK:
            _ACTIVE_REORG_WORKERS.pop(session_id, None)
        logger.debug(
            "Reorganization worker finished session_id=%s warehouse_id=%s",
            session_id,
            warehouse_id,
        )
