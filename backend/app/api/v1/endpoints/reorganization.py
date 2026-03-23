from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_warehouse_membership
from app.db.session import get_db
from app.models.reorganization_session import ReorganizationSession
from app.models.user import User
from app.schemas.reorganization import ReorganizationSessionRead
from app.services.reorganization import confirm_suggestion, dismiss_suggestion
from app.services.reorganization_workers import start_reorganization_worker

router = APIRouter(
    prefix="/warehouses/{warehouse_id}/reorganization",
    tags=["reorganization"],
)


def _session_to_read(session: ReorganizationSession) -> ReorganizationSessionRead:
    return ReorganizationSessionRead.model_validate(session)


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def create_session(
    warehouse_id: str,
    force: bool = Query(default=False),
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JSONResponse:
    """Create a new reorganization session (or return the existing one if force=False)."""
    # Look for an existing running/ready session
    existing = db.scalar(
        select(ReorganizationSession).where(
            ReorganizationSession.warehouse_id == warehouse_id,
            ReorganizationSession.status.in_(["running", "ready"]),
        )
    )

    if existing is not None and not force:
        data = _session_to_read(existing)
        return JSONResponse(
            content=json.loads(data.model_dump_json()),
            status_code=status.HTTP_200_OK,
        )

    if existing is not None and force:
        existing.status = "archived"
        db.flush()

    new_session = ReorganizationSession(
        id=str(uuid.uuid4()),
        warehouse_id=warehouse_id,
        created_by=current_user.id,
        status="running",
        suggestions=[],
        error_message=None,
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    start_reorganization_worker(new_session.id, warehouse_id)

    data = _session_to_read(new_session)
    return JSONResponse(
        content=json.loads(data.model_dump_json()),
        status_code=status.HTTP_201_CREATED,
    )


@router.get(
    "/sessions/current",
    response_model=ReorganizationSessionRead,
)
def get_current_session(
    warehouse_id: str,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> ReorganizationSessionRead:
    """Return the current (running/ready) session, or the most recent one."""
    # Prefer running or ready
    session = db.scalar(
        select(ReorganizationSession).where(
            ReorganizationSession.warehouse_id == warehouse_id,
            ReorganizationSession.status.in_(["running", "ready"]),
        ).order_by(ReorganizationSession.created_at.desc())
    )

    if session is None:
        # Fall back to most recent completed/archived
        session = db.scalar(
            select(ReorganizationSession).where(
                ReorganizationSession.warehouse_id == warehouse_id,
            ).order_by(ReorganizationSession.created_at.desc())
        )

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No reorganization session found for this warehouse",
        )

    return _session_to_read(session)


def _get_session(db: Session, warehouse_id: str, session_id: str) -> ReorganizationSession:
    session = db.scalar(
        select(ReorganizationSession).where(
            ReorganizationSession.id == session_id,
            ReorganizationSession.warehouse_id == warehouse_id,
        )
    )
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reorganization session not found",
        )
    return session


@router.post(
    "/sessions/{session_id}/suggestions/{suggestion_id}/confirm",
    response_model=ReorganizationSessionRead,
)
def confirm_suggestion_endpoint(
    warehouse_id: str,
    session_id: str,
    suggestion_id: str,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReorganizationSessionRead:
    """Confirm a suggestion: move the item to the target box."""
    session = _get_session(db, warehouse_id, session_id)
    try:
        updated = confirm_suggestion(session, suggestion_id, db, current_user.id)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _session_to_read(updated)


@router.post(
    "/sessions/{session_id}/suggestions/{suggestion_id}/dismiss",
    response_model=ReorganizationSessionRead,
)
def dismiss_suggestion_endpoint(
    warehouse_id: str,
    session_id: str,
    suggestion_id: str,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> ReorganizationSessionRead:
    """Dismiss a suggestion without moving the item."""
    session = _get_session(db, warehouse_id, session_id)
    try:
        updated = dismiss_suggestion(session, suggestion_id, db)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _session_to_read(updated)
