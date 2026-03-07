from datetime import UTC, datetime, timedelta
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_warehouse_membership
from app.core.config import settings
from app.db.session import get_db
from app.models.activity_event import ActivityEvent
from app.models.box import Box
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
from app.services.box_codes import generate_unique_short_code
from app.services.security import hash_token
from app.services.sync_log import append_change_log

router = APIRouter(prefix="/warehouses", tags=["warehouses"])
invites_router = APIRouter(prefix="/invites", tags=["warehouses"])
INBOUND_BOX_DEFAULT_NAME = "Entrada de mercancias"
logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _new_qr_token() -> str:
    return secrets.token_urlsafe(24)


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
    warehouses = rows.all()
    logger.debug("Listed warehouses user_id=%s count=%s", current_user.id, len(warehouses))
    return [WarehouseResponse.model_validate(r) for r in warehouses]


@router.post("", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(
    payload: WarehouseCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WarehouseResponse:
    logger.debug("Create warehouse requested user_id=%s name=%s", current_user.id, payload.name)
    warehouse = Warehouse(name=payload.name.strip(), created_by=current_user.id)
    db.add(warehouse)
    db.flush()

    membership = Membership(user_id=current_user.id, warehouse_id=warehouse.id)
    db.add(membership)
    inbound_box = Box(
        warehouse_id=warehouse.id,
        parent_box_id=None,
        name=INBOUND_BOX_DEFAULT_NAME,
        description="Caja de entrada para mercancias pendientes de ubicar",
        physical_location=None,
        qr_token=_new_qr_token(),
        short_code=generate_unique_short_code(db),
        is_inbound=True,
    )
    db.add(inbound_box)
    db.flush()
    record_activity(
        db,
        warehouse_id=warehouse.id,
        actor_user_id=current_user.id,
        event_type="warehouse.created",
        entity_type="warehouse",
        entity_id=warehouse.id,
        metadata={"name": warehouse.name},
    )
    record_activity(
        db,
        warehouse_id=warehouse.id,
        actor_user_id=current_user.id,
        event_type="box.created",
        entity_type="box",
        entity_id=inbound_box.id,
        metadata={"name": inbound_box.name, "is_inbound": True},
    )
    append_change_log(
        db,
        warehouse_id=warehouse.id,
        entity_type="box",
        entity_id=inbound_box.id,
        action="create",
        entity_version=inbound_box.version,
        payload={
            "name": inbound_box.name,
            "parent_box_id": inbound_box.parent_box_id,
            "is_inbound": True,
        },
    )
    db.commit()
    db.refresh(warehouse)
    logger.info("Warehouse created warehouse_id=%s created_by=%s", warehouse.id, current_user.id)
    return WarehouseResponse.model_validate(warehouse)


@router.get("/{warehouse_id}", response_model=WarehouseResponse)
def get_warehouse(
    warehouse_id: str,
    _membership: Membership = Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> WarehouseResponse:
    warehouse = db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id))
    if warehouse is None:
        logger.error("Warehouse not found warehouse_id=%s", warehouse_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    logger.debug("Warehouse details requested warehouse_id=%s", warehouse_id)
    return WarehouseResponse.model_validate(warehouse)


@router.get("/{warehouse_id}/members", response_model=list[MemberResponse])
def get_members(
    warehouse_id: str,
    _membership: Membership = Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> list[MemberResponse]:
    members = db.scalars(select(Membership).where(Membership.warehouse_id == warehouse_id))
    memberships = members.all()
    logger.debug("Warehouse members listed warehouse_id=%s count=%s", warehouse_id, len(memberships))
    return [
        MemberResponse(user_id=m.user_id, warehouse_id=m.warehouse_id, created_at=m.created_at)
        for m in memberships
    ]


@router.post("/{warehouse_id}/invites", response_model=WarehouseInviteResponse, status_code=status.HTTP_201_CREATED)
def create_invite(
    warehouse_id: str,
    payload: WarehouseInviteCreateRequest,
    _membership: Membership = Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WarehouseInviteResponse:
    logger.debug(
        "Create invite requested warehouse_id=%s requested_by=%s email=%s",
        warehouse_id,
        current_user.id,
        payload.email.lower().strip() if payload.email else None,
    )
    warehouse = db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id))
    if warehouse is None:
        logger.error("Create invite failed: warehouse not found warehouse_id=%s", warehouse_id)
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
    logger.info("Invite created warehouse_id=%s invite_id=%s", warehouse_id, invite.id)
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
    logger.debug("Accept invite requested user_id=%s", current_user.id)
    token_hash_value = hash_token(token)
    invite = db.scalar(select(WarehouseInvite).where(WarehouseInvite.token_hash == token_hash_value))
    if invite is None:
        logger.error("Accept invite failed: invite token not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    if invite.accepted_at is not None or invite.expires_at < utcnow():
        logger.error("Accept invite failed: invite already used or expired invite_id=%s", invite.id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite expired or already used")

    if invite.invitee_email and invite.invitee_email.lower() != current_user.email.lower():
        logger.error(
            "Accept invite failed: email mismatch invite_id=%s expected=%s current=%s",
            invite.id,
            invite.invitee_email,
            current_user.email,
        )
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
    logger.info(
        "Invite accepted invite_id=%s warehouse_id=%s user_id=%s",
        invite.id,
        invite.warehouse_id,
        current_user.id,
    )
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
    logger.debug(
        "Warehouse activity listed warehouse_id=%s requested_limit=%s resolved_limit=%s count=%s",
        warehouse_id,
        limit,
        safe_limit,
        len(events),
    )
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
