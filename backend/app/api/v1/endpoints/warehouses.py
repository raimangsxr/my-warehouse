from datetime import UTC, datetime, timedelta
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_warehouse_membership
from app.core.config import settings
from app.db.session import get_db
from app.models.activity_event import ActivityEvent
from app.models.membership import Membership
from app.models.user import User
from app.models.warehouse import Warehouse
from app.models.warehouse_invite import WarehouseInvite
from app.schemas.warehouse import (
    ActivityEventResponse,
    InviteAcceptResponse,
    MemberResponse,
    WarehouseCreateRequest,
    WarehouseInviteCreateRequest,
    WarehouseInviteResponse,
    WarehouseResponse,
)
from app.services.activity import record_activity
from app.services.security import hash_token

router = APIRouter(prefix="/warehouses", tags=["warehouses"])
invites_router = APIRouter(prefix="/invites", tags=["warehouses"])


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


@router.get("", response_model=list[WarehouseResponse])
def list_warehouses(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[WarehouseResponse]:
    rows = db.scalars(
        select(Warehouse)
        .join(Membership, Membership.warehouse_id == Warehouse.id)
        .where(Membership.user_id == current_user.id)
        .order_by(Warehouse.created_at.desc())
    )
    return [WarehouseResponse.model_validate(r) for r in rows.all()]


@router.post("", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(
    payload: WarehouseCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WarehouseResponse:
    warehouse = Warehouse(name=payload.name.strip(), created_by=current_user.id)
    db.add(warehouse)
    db.flush()

    membership = Membership(user_id=current_user.id, warehouse_id=warehouse.id)
    db.add(membership)
    record_activity(
        db,
        warehouse_id=warehouse.id,
        actor_user_id=current_user.id,
        event_type="warehouse.created",
        entity_type="warehouse",
        entity_id=warehouse.id,
        metadata={"name": warehouse.name},
    )
    db.commit()
    db.refresh(warehouse)
    return WarehouseResponse.model_validate(warehouse)


@router.get("/{warehouse_id}", response_model=WarehouseResponse)
def get_warehouse(
    warehouse_id: str,
    _membership: Membership = Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> WarehouseResponse:
    warehouse = db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id))
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return WarehouseResponse.model_validate(warehouse)


@router.get("/{warehouse_id}/members", response_model=list[MemberResponse])
def get_members(
    warehouse_id: str,
    _membership: Membership = Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> list[MemberResponse]:
    members = db.scalars(select(Membership).where(Membership.warehouse_id == warehouse_id))
    return [
        MemberResponse(user_id=m.user_id, warehouse_id=m.warehouse_id, created_at=m.created_at)
        for m in members.all()
    ]


@router.post("/{warehouse_id}/invites", response_model=WarehouseInviteResponse, status_code=status.HTTP_201_CREATED)
def create_invite(
    warehouse_id: str,
    payload: WarehouseInviteCreateRequest,
    _membership: Membership = Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WarehouseInviteResponse:
    warehouse = db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id))
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    invite_token = secrets.token_urlsafe(32)
    invite = WarehouseInvite(
        warehouse_id=warehouse_id,
        invited_by=current_user.id,
        invitee_email=payload.email.lower().strip() if payload.email else None,
        token_hash=hash_token(invite_token),
        expires_at=utcnow() + timedelta(hours=payload.expires_in_hours),
    )
    db.add(invite)
    record_activity(
        db,
        warehouse_id=warehouse_id,
        actor_user_id=current_user.id,
        event_type="invite.created",
        entity_type="invite",
        entity_id=invite.id,
        metadata={"email": invite.invitee_email},
    )
    db.commit()

    invite_url = f"{settings.frontend_url.rstrip('/')}/invites/{invite_token}"
    return WarehouseInviteResponse(
        warehouse_id=warehouse_id,
        invite_token=invite_token,
        invite_url=invite_url,
        expires_at=invite.expires_at,
    )


@invites_router.post("/{token}/accept", response_model=InviteAcceptResponse)
def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InviteAcceptResponse:
    token_hash_value = hash_token(token)
    invite = db.scalar(select(WarehouseInvite).where(WarehouseInvite.token_hash == token_hash_value))
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    if invite.accepted_at is not None or invite.expires_at < utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite expired or already used")

    if invite.invitee_email and invite.invitee_email.lower() != current_user.email.lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invite does not belong to this email")

    existing = db.scalar(
        select(Membership).where(
            Membership.user_id == current_user.id,
            Membership.warehouse_id == invite.warehouse_id,
        )
    )
    if existing is None:
        db.add(Membership(user_id=current_user.id, warehouse_id=invite.warehouse_id))

    invite.accepted_at = utcnow()
    record_activity(
        db,
        warehouse_id=invite.warehouse_id,
        actor_user_id=current_user.id,
        event_type="invite.accepted",
        entity_type="invite",
        entity_id=invite.id,
        metadata={"invitee_email": current_user.email},
    )
    db.commit()
    return InviteAcceptResponse(message="Invite accepted", warehouse_id=invite.warehouse_id)


@router.get("/{warehouse_id}/activity", response_model=list[ActivityEventResponse])
def get_activity(
    warehouse_id: str,
    limit: int = 50,
    _membership: Membership = Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> list[ActivityEventResponse]:
    safe_limit = max(1, min(limit, 200))
    events = db.scalars(
        select(ActivityEvent)
        .where(ActivityEvent.warehouse_id == warehouse_id)
        .order_by(ActivityEvent.created_at.desc())
        .limit(safe_limit)
    ).all()
    return [
        ActivityEventResponse(
            id=event.id,
            warehouse_id=event.warehouse_id,
            actor_user_id=event.actor_user_id,
            event_type=event.event_type,
            entity_type=event.entity_type,
            entity_id=event.entity_id,
            metadata=event.metadata_json or {},
            created_at=event.created_at,
        )
        for event in events
    ]
