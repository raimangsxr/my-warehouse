from datetime import UTC, datetime
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_warehouse_membership
from app.db.session import get_db
from app.models.box import Box
from app.models.change_log import ChangeLog
from app.models.item import Item
from app.models.item_favorite import ItemFavorite
from app.models.processed_command import ProcessedCommand
from app.models.stock_movement import StockMovement
from app.models.sync_conflict import SyncConflict
from app.models.user import User
from app.schemas.sync import (
    SyncChangeEntry,
    SyncConflictResolution,
    SyncConflictResponse,
    SyncPullResponse,
    SyncPushRequest,
    SyncPushResponse,
    SyncResolveRequest,
    SyncResolveResponse,
)
from app.services.sync_log import append_change_log

router = APIRouter(prefix="/sync", tags=["sync"])


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _get_box(db: Session, warehouse_id: str, box_id: str, include_deleted: bool = False) -> Box:
    query = select(Box).where(Box.id == box_id, Box.warehouse_id == warehouse_id)
    if not include_deleted:
        query = query.where(Box.deleted_at.is_(None))
    box = db.scalar(query)
    if box is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Box not found")
    return box


def _get_item(db: Session, warehouse_id: str, item_id: str, include_deleted: bool = False) -> Item:
    query = select(Item).where(Item.id == item_id, Item.warehouse_id == warehouse_id)
    if not include_deleted:
        query = query.where(Item.deleted_at.is_(None))
    item = db.scalar(query)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


def _serialize_conflict(conflict: SyncConflict) -> SyncConflictResponse:
    return SyncConflictResponse(
        id=conflict.id,
        warehouse_id=conflict.warehouse_id,
        command_id=conflict.command_id,
        entity_type=conflict.entity_type,
        entity_id=conflict.entity_id,
        base_version=conflict.base_version,
        server_version=conflict.server_version,
        client_payload=conflict.client_payload_json or {},
        status=conflict.status,
        created_at=conflict.created_at,
        resolved_at=conflict.resolved_at,
    )


def _create_or_get_conflict(
    db: Session,
    *,
    warehouse_id: str,
    command_id: str,
    entity_type: str,
    entity_id: str,
    base_version: int | None,
    server_version: int | None,
    client_payload: dict,
    created_by: str,
) -> SyncConflict:
    existing = db.scalar(select(SyncConflict).where(SyncConflict.command_id == command_id))
    if existing is not None:
        return existing

    conflict = SyncConflict(
        warehouse_id=warehouse_id,
        command_id=command_id,
        entity_type=entity_type,
        entity_id=entity_id,
        base_version=base_version,
        server_version=server_version,
        client_payload_json=client_payload,
        status="open",
        created_by=created_by,
    )
    db.add(conflict)
    db.flush()
    return conflict


def _check_version_conflict(
    db: Session,
    *,
    warehouse_id: str,
    command_id: str,
    entity_type: str,
    entity_id: str,
    base_version: int | None,
    server_version: int,
    client_payload: dict,
    user_id: str,
) -> SyncConflict | None:
    if base_version is None or base_version == server_version:
        return None
    return _create_or_get_conflict(
        db,
        warehouse_id=warehouse_id,
        command_id=command_id,
        entity_type=entity_type,
        entity_id=entity_id,
        base_version=base_version,
        server_version=server_version,
        client_payload=client_payload,
        created_by=user_id,
    )


def _apply_sync_command(
    db: Session,
    *,
    warehouse_id: str,
    user: User,
    command_id: str,
    command_type: str,
    entity_id: str | None,
    base_version: int | None,
    payload: dict,
) -> SyncConflict | None:
    command_type = command_type.strip().lower()

    if command_type == "box.create":
        parent_box_id = payload.get("parent_box_id")
        if parent_box_id:
            _get_box(db, warehouse_id, parent_box_id)

        box_id = entity_id or payload.get("id") or str(uuid.uuid4())
        existing = db.scalar(select(Box).where(Box.id == box_id, Box.warehouse_id == warehouse_id))
        if existing is None:
            box = Box(
                id=box_id,
                warehouse_id=warehouse_id,
                parent_box_id=parent_box_id,
                name=(payload.get("name") or "Caja Sync").strip(),
                description=payload.get("description"),
                physical_location=payload.get("physical_location"),
                qr_token=payload.get("qr_token") or secrets.token_urlsafe(24),
                short_code=payload.get("short_code") or f"BX-{secrets.token_hex(3).upper()}",
                version=1,
            )
            db.add(box)
            db.flush()
        else:
            box = existing

        append_change_log(
            db,
            warehouse_id=warehouse_id,
            entity_type="box",
            entity_id=box.id,
            action="create",
            entity_version=box.version,
            payload={"name": box.name, "parent_box_id": box.parent_box_id},
        )
        return None

    if command_type in {"box.update", "box.move", "box.delete", "box.restore"}:
        box = _get_box(db, warehouse_id, entity_id or "", include_deleted=True)
        conflict = _check_version_conflict(
            db,
            warehouse_id=warehouse_id,
            command_id=command_id,
            entity_type="box",
            entity_id=box.id,
            base_version=base_version,
            server_version=box.version,
            client_payload=payload,
            user_id=user.id,
        )
        if conflict is not None:
            return conflict

        if command_type == "box.update":
            if "name" in payload and payload["name"] is not None:
                box.name = str(payload["name"]).strip()
            if "description" in payload:
                box.description = payload["description"]
            if "physical_location" in payload:
                box.physical_location = payload["physical_location"]
            box.version += 1
            append_change_log(
                db,
                warehouse_id=warehouse_id,
                entity_type="box",
                entity_id=box.id,
                action="update",
                entity_version=box.version,
                payload=payload,
            )
            return None

        if command_type == "box.move":
            new_parent = payload.get("new_parent_box_id")
            if new_parent:
                _get_box(db, warehouse_id, new_parent)
            box.parent_box_id = new_parent
            box.version += 1
            append_change_log(
                db,
                warehouse_id=warehouse_id,
                entity_type="box",
                entity_id=box.id,
                action="move",
                entity_version=box.version,
                payload={"new_parent_box_id": new_parent},
            )
            return None

        if command_type == "box.delete":
            if box.deleted_at is None:
                box.deleted_at = utcnow()
                box.version += 1
                append_change_log(
                    db,
                    warehouse_id=warehouse_id,
                    entity_type="box",
                    entity_id=box.id,
                    action="delete",
                    entity_version=box.version,
                )
            return None

        if box.deleted_at is not None:
            box.deleted_at = None
            box.version += 1
            append_change_log(
                db,
                warehouse_id=warehouse_id,
                entity_type="box",
                entity_id=box.id,
                action="restore",
                entity_version=box.version,
            )
        return None

    if command_type == "item.create":
        box_id = payload.get("box_id")
        if not box_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="item.create requires box_id")
        _get_box(db, warehouse_id, box_id)

        item_pk = entity_id or payload.get("id") or str(uuid.uuid4())
        existing = db.scalar(select(Item).where(Item.id == item_pk, Item.warehouse_id == warehouse_id))
        if existing is None:
            item = Item(
                id=item_pk,
                warehouse_id=warehouse_id,
                box_id=box_id,
                name=(payload.get("name") or "Item Sync").strip(),
                description=payload.get("description"),
                photo_url=payload.get("photo_url"),
                physical_location=payload.get("physical_location"),
                tags=payload.get("tags") or [],
                aliases=payload.get("aliases") or [],
                version=1,
            )
            db.add(item)
            db.flush()
        else:
            item = existing

        append_change_log(
            db,
            warehouse_id=warehouse_id,
            entity_type="item",
            entity_id=item.id,
            action="create",
            entity_version=item.version,
            payload={"name": item.name, "box_id": item.box_id},
        )
        return None

    if command_type in {"item.update", "item.delete", "item.restore", "item.favorite", "item.unfavorite"}:
        item = _get_item(db, warehouse_id, entity_id or "", include_deleted=True)

        if command_type in {"item.update", "item.delete", "item.restore"}:
            conflict = _check_version_conflict(
                db,
                warehouse_id=warehouse_id,
                command_id=command_id,
                entity_type="item",
                entity_id=item.id,
                base_version=base_version,
                server_version=item.version,
                client_payload=payload,
                user_id=user.id,
            )
            if conflict is not None:
                return conflict

        if command_type == "item.update":
            if "box_id" in payload and payload["box_id"] is not None:
                _get_box(db, warehouse_id, payload["box_id"])
                item.box_id = payload["box_id"]
            if "name" in payload and payload["name"] is not None:
                item.name = str(payload["name"]).strip()
            if "description" in payload:
                item.description = payload["description"]
            if "photo_url" in payload:
                item.photo_url = payload["photo_url"]
            if "physical_location" in payload:
                item.physical_location = payload["physical_location"]
            if "tags" in payload and payload["tags"] is not None:
                item.tags = payload["tags"]
            if "aliases" in payload and payload["aliases"] is not None:
                item.aliases = payload["aliases"]
            item.version += 1
            append_change_log(
                db,
                warehouse_id=warehouse_id,
                entity_type="item",
                entity_id=item.id,
                action="update",
                entity_version=item.version,
                payload=payload,
            )
            return None

        if command_type == "item.delete":
            if item.deleted_at is None:
                item.deleted_at = utcnow()
                item.version += 1
                append_change_log(
                    db,
                    warehouse_id=warehouse_id,
                    entity_type="item",
                    entity_id=item.id,
                    action="delete",
                    entity_version=item.version,
                )
            return None

        if command_type == "item.restore":
            if item.deleted_at is not None:
                _get_box(db, warehouse_id, item.box_id)
                item.deleted_at = None
                item.version += 1
                append_change_log(
                    db,
                    warehouse_id=warehouse_id,
                    entity_type="item",
                    entity_id=item.id,
                    action="restore",
                    entity_version=item.version,
                )
            return None

        existing_favorite = db.scalar(
            select(ItemFavorite).where(ItemFavorite.user_id == user.id, ItemFavorite.item_id == item.id)
        )
        make_favorite = command_type == "item.favorite"
        if make_favorite and existing_favorite is None:
            db.add(ItemFavorite(user_id=user.id, item_id=item.id))
        if (not make_favorite) and existing_favorite is not None:
            db.delete(existing_favorite)
        append_change_log(
            db,
            warehouse_id=warehouse_id,
            entity_type="favorite",
            entity_id=item.id,
            action="set",
            payload={"user_id": user.id, "is_favorite": make_favorite},
        )
        return None

    if command_type == "stock.adjust":
        item = _get_item(db, warehouse_id, entity_id or "")
        delta = int(payload.get("delta", 0))
        if delta not in (-1, 1):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="stock.adjust delta must be +1/-1")

        movement = db.scalar(
            select(StockMovement).where(
                StockMovement.item_id == item.id,
                StockMovement.command_id == command_id,
            )
        )
        if movement is None:
            db.add(
                StockMovement(
                    warehouse_id=warehouse_id,
                    item_id=item.id,
                    delta=delta,
                    command_id=command_id,
                    note=payload.get("note"),
                )
            )
            append_change_log(
                db,
                warehouse_id=warehouse_id,
                entity_type="stock",
                entity_id=item.id,
                action="adjust",
                payload={"delta": delta, "command_id": command_id},
            )
        return None

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported command type: {command_type}")


@router.post("/push", response_model=SyncPushResponse)
def push_commands(
    payload: SyncPushRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SyncPushResponse:
    applied_command_ids: list[str] = []
    skipped_command_ids: list[str] = []
    conflicts: list[SyncConflictResponse] = []

    # Path-parameter-free endpoint: enforce membership with request warehouse_id.
    require_warehouse_membership(payload.warehouse_id, current_user=current_user, db=db)

    seen_in_request: set[str] = set()
    for command in payload.commands:
        if command.command_id in seen_in_request:
            skipped_command_ids.append(command.command_id)
            continue
        seen_in_request.add(command.command_id)

        processed = db.scalar(select(ProcessedCommand).where(ProcessedCommand.command_id == command.command_id))
        if processed is not None:
            skipped_command_ids.append(command.command_id)
            continue

        existing_conflict = db.scalar(select(SyncConflict).where(SyncConflict.command_id == command.command_id))
        if existing_conflict is not None:
            conflicts.append(_serialize_conflict(existing_conflict))
            skipped_command_ids.append(command.command_id)
            continue

        conflict = _apply_sync_command(
            db,
            warehouse_id=payload.warehouse_id,
            user=current_user,
            command_id=command.command_id,
            command_type=command.type,
            entity_id=command.entity_id,
            base_version=command.base_version,
            payload=command.payload,
        )
        if conflict is not None:
            conflicts.append(_serialize_conflict(conflict))
            continue

        db.add(
            ProcessedCommand(
                command_id=command.command_id,
                warehouse_id=payload.warehouse_id,
                user_id=current_user.id,
                device_id=payload.device_id,
            )
        )
        applied_command_ids.append(command.command_id)

    db.commit()
    last_seq = (
        db.scalar(select(func.coalesce(func.max(ChangeLog.seq), 0)).where(ChangeLog.warehouse_id == payload.warehouse_id))
        or 0
    )
    return SyncPushResponse(
        applied_command_ids=applied_command_ids,
        skipped_command_ids=skipped_command_ids,
        conflicts=conflicts,
        last_seq=int(last_seq),
    )


@router.get("/pull", response_model=SyncPullResponse)
def pull_changes(
    warehouse_id: str,
    since_seq: int = 0,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SyncPullResponse:
    require_warehouse_membership(warehouse_id, current_user=current_user, db=db)

    change_rows = db.scalars(
        select(ChangeLog)
        .where(ChangeLog.warehouse_id == warehouse_id, ChangeLog.seq > since_seq)
        .order_by(ChangeLog.seq.asc())
        .limit(500)
    ).all()

    conflict_rows = db.scalars(
        select(SyncConflict)
        .where(SyncConflict.warehouse_id == warehouse_id, SyncConflict.status == "open")
        .order_by(SyncConflict.created_at.asc())
    ).all()

    last_seq = (
        db.scalar(select(func.coalesce(func.max(ChangeLog.seq), 0)).where(ChangeLog.warehouse_id == warehouse_id))
        or 0
    )

    changes = [
        SyncChangeEntry(
            seq=row.seq,
            warehouse_id=row.warehouse_id,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            action=row.action,
            entity_version=row.entity_version,
            payload=row.payload_json or {},
            created_at=row.created_at,
        )
        for row in change_rows
    ]

    return SyncPullResponse(
        changes=changes,
        conflicts=[_serialize_conflict(row) for row in conflict_rows],
        last_seq=int(last_seq),
    )


@router.post("/resolve", response_model=SyncResolveResponse)
def resolve_conflict(
    payload: SyncResolveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SyncResolveResponse:
    require_warehouse_membership(payload.warehouse_id, current_user=current_user, db=db)

    conflict = db.scalar(
        select(SyncConflict).where(
            SyncConflict.id == payload.conflict_id,
            SyncConflict.warehouse_id == payload.warehouse_id,
        )
    )
    if conflict is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conflict not found")
    if conflict.status != "open":
        return SyncResolveResponse(message="Conflict already resolved", conflict=_serialize_conflict(conflict))

    if payload.resolution == SyncConflictResolution.keep_server:
        conflict.status = "resolved"
        conflict.resolved_at = utcnow()
        conflict.resolved_by = current_user.id
        db.commit()
        db.refresh(conflict)
        return SyncResolveResponse(message="Conflict resolved with server state", conflict=_serialize_conflict(conflict))

    source_payload = payload.payload or {}
    if payload.resolution == SyncConflictResolution.keep_client and not source_payload:
        source_payload = conflict.client_payload_json or {}

    if conflict.entity_type == "box":
        box = _get_box(db, payload.warehouse_id, conflict.entity_id, include_deleted=True)
        if "name" in source_payload and source_payload["name"] is not None:
            box.name = str(source_payload["name"]).strip()
        if "description" in source_payload:
            box.description = source_payload["description"]
        if "physical_location" in source_payload:
            box.physical_location = source_payload["physical_location"]
        if "new_parent_box_id" in source_payload:
            new_parent = source_payload["new_parent_box_id"]
            if new_parent:
                _get_box(db, payload.warehouse_id, new_parent)
            box.parent_box_id = new_parent
        box.version += 1
        append_change_log(
            db,
            warehouse_id=payload.warehouse_id,
            entity_type="box",
            entity_id=box.id,
            action="resolve",
            entity_version=box.version,
            payload=source_payload,
        )

    elif conflict.entity_type == "item":
        item = _get_item(db, payload.warehouse_id, conflict.entity_id, include_deleted=True)
        if "box_id" in source_payload and source_payload["box_id"] is not None:
            _get_box(db, payload.warehouse_id, source_payload["box_id"])
            item.box_id = source_payload["box_id"]
        if "name" in source_payload and source_payload["name"] is not None:
            item.name = str(source_payload["name"]).strip()
        if "description" in source_payload:
            item.description = source_payload["description"]
        if "photo_url" in source_payload:
            item.photo_url = source_payload["photo_url"]
        if "physical_location" in source_payload:
            item.physical_location = source_payload["physical_location"]
        if "tags" in source_payload and source_payload["tags"] is not None:
            item.tags = source_payload["tags"]
        if "aliases" in source_payload and source_payload["aliases"] is not None:
            item.aliases = source_payload["aliases"]
        item.version += 1
        append_change_log(
            db,
            warehouse_id=payload.warehouse_id,
            entity_type="item",
            entity_id=item.id,
            action="resolve",
            entity_version=item.version,
            payload=source_payload,
        )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported conflict entity_type")

    conflict.status = "resolved"
    conflict.resolved_at = utcnow()
    conflict.resolved_by = current_user.id

    db.commit()
    db.refresh(conflict)
    return SyncResolveResponse(message="Conflict resolved", conflict=_serialize_conflict(conflict))
