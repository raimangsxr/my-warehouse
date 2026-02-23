from datetime import UTC, datetime
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_warehouse_membership
from app.db.session import get_db
from app.models.box import Box
from app.models.item import Item
from app.models.stock_movement import StockMovement
from app.models.user import User
from app.models.warehouse import Warehouse
from app.schemas.transfer import (
    ExportBox,
    ExportItem,
    ExportStockMovement,
    ExportWarehouse,
    WarehouseExportResponse,
    WarehouseImportRequest,
    WarehouseImportResponse,
)
from app.services.sync_log import append_change_log

router = APIRouter(prefix="/warehouses/{warehouse_id}", tags=["transfer"])


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _get_warehouse(db: Session, warehouse_id: str) -> Warehouse:
    warehouse = db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id))
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return warehouse


@router.get("/export", response_model=WarehouseExportResponse)
def export_warehouse(
    warehouse_id: str,
    _membership=Depends(require_warehouse_membership),
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WarehouseExportResponse:
    warehouse = _get_warehouse(db, warehouse_id)

    boxes = db.scalars(select(Box).where(Box.warehouse_id == warehouse_id).order_by(Box.created_at.asc())).all()
    items = db.scalars(select(Item).where(Item.warehouse_id == warehouse_id).order_by(Item.created_at.asc())).all()
    stock_movements = db.scalars(
        select(StockMovement).where(StockMovement.warehouse_id == warehouse_id).order_by(StockMovement.created_at.asc())
    ).all()

    return WarehouseExportResponse(
        exported_at=utcnow(),
        warehouse=ExportWarehouse(id=warehouse.id, name=warehouse.name),
        boxes=[
            ExportBox(
                id=box.id,
                parent_box_id=box.parent_box_id,
                name=box.name,
                description=box.description,
                physical_location=box.physical_location,
                short_code=box.short_code,
                qr_token=box.qr_token,
                version=box.version,
                deleted_at=box.deleted_at,
            )
            for box in boxes
        ],
        items=[
            ExportItem(
                id=item.id,
                box_id=item.box_id,
                name=item.name,
                description=item.description,
                photo_url=item.photo_url,
                physical_location=item.physical_location,
                tags=item.tags or [],
                aliases=item.aliases or [],
                version=item.version,
                deleted_at=item.deleted_at,
            )
            for item in items
        ],
        stock_movements=[
            ExportStockMovement(
                id=movement.id,
                item_id=movement.item_id,
                delta=movement.delta,
                command_id=movement.command_id,
                note=movement.note,
                created_at=movement.created_at,
            )
            for movement in stock_movements
        ],
    )


@router.post("/import", response_model=WarehouseImportResponse)
def import_warehouse(
    warehouse_id: str,
    payload: WarehouseImportRequest,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WarehouseImportResponse:
    warehouse = _get_warehouse(db, warehouse_id)

    parent_ids = {box.id for box in payload.boxes}
    for box in payload.boxes:
        if box.parent_box_id and box.parent_box_id not in parent_ids:
            exists_parent = db.scalar(
                select(Box.id).where(Box.id == box.parent_box_id, Box.warehouse_id == warehouse_id)
            )
            if exists_parent is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Parent box {box.parent_box_id} not found for box {box.id}",
                )

    warehouse.name = payload.warehouse.name.strip() or warehouse.name

    box_id_map: dict[str, str] = {}
    for box_payload in payload.boxes:
        existing_by_id = db.scalar(select(Box).where(Box.id == box_payload.id))
        if existing_by_id is None or existing_by_id.warehouse_id == warehouse_id:
            box_id_map[box_payload.id] = box_payload.id
        else:
            box_id_map[box_payload.id] = str(uuid.uuid4())

    pending_boxes = {box.id: box for box in payload.boxes}
    boxes_upserted = 0

    while pending_boxes:
        progressed = False
        for box_id, box_payload in list(pending_boxes.items()):
            parent_id = box_payload.parent_box_id
            if parent_id and parent_id in pending_boxes:
                continue

            mapped_box_id = box_id_map[box_payload.id]
            mapped_parent_id = box_id_map.get(box_payload.parent_box_id) if box_payload.parent_box_id else None
            existing_box = db.scalar(select(Box).where(Box.id == mapped_box_id, Box.warehouse_id == warehouse_id))
            if existing_box is None:
                qr_token = box_payload.qr_token
                qr_owner = db.scalar(select(Box.id).where(Box.qr_token == qr_token))
                if qr_owner is not None and qr_owner != mapped_box_id:
                    qr_token = secrets.token_urlsafe(24)
                short_code = box_payload.short_code
                if qr_token != box_payload.qr_token:
                    short_code = f"BX-{secrets.token_hex(3).upper()}"

                db.add(
                    Box(
                        id=mapped_box_id,
                        warehouse_id=warehouse_id,
                        parent_box_id=mapped_parent_id,
                        name=box_payload.name,
                        description=box_payload.description,
                        physical_location=box_payload.physical_location,
                        short_code=short_code,
                        qr_token=qr_token,
                        version=box_payload.version,
                        deleted_at=box_payload.deleted_at,
                    )
                )
            else:
                qr_token = box_payload.qr_token
                qr_owner = db.scalar(
                    select(Box.id).where(Box.qr_token == qr_token, Box.id != existing_box.id)
                )
                if qr_owner is not None:
                    qr_token = existing_box.qr_token
                existing_box.parent_box_id = mapped_parent_id
                existing_box.name = box_payload.name
                existing_box.description = box_payload.description
                existing_box.physical_location = box_payload.physical_location
                existing_box.short_code = box_payload.short_code
                existing_box.qr_token = qr_token
                existing_box.version = box_payload.version
                existing_box.deleted_at = box_payload.deleted_at

            append_change_log(
                db,
                warehouse_id=warehouse_id,
                entity_type="box",
                entity_id=mapped_box_id,
                action="import",
                entity_version=box_payload.version,
                payload={"name": box_payload.name},
            )
            boxes_upserted += 1
            pending_boxes.pop(box_id)
            progressed = True

        if not progressed:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cyclic or invalid box parent references")

    item_box_ids = set(db.scalars(select(Box.id).where(Box.warehouse_id == warehouse_id)).all())
    item_id_map: dict[str, str] = {}
    for item_payload in payload.items:
        existing_by_id = db.scalar(select(Item).where(Item.id == item_payload.id))
        if existing_by_id is None or existing_by_id.warehouse_id == warehouse_id:
            item_id_map[item_payload.id] = item_payload.id
        else:
            item_id_map[item_payload.id] = str(uuid.uuid4())

    items_upserted = 0
    for item_payload in payload.items:
        mapped_item_id = item_id_map[item_payload.id]
        mapped_box_id = box_id_map.get(item_payload.box_id, item_payload.box_id)

        if mapped_box_id not in item_box_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Box {item_payload.box_id} not found for item {item_payload.id}",
            )

        existing_item = db.scalar(select(Item).where(Item.id == mapped_item_id, Item.warehouse_id == warehouse_id))
        if existing_item is None:
            db.add(
                Item(
                    id=mapped_item_id,
                    warehouse_id=warehouse_id,
                    box_id=mapped_box_id,
                    name=item_payload.name,
                    description=item_payload.description,
                    photo_url=item_payload.photo_url,
                    physical_location=item_payload.physical_location,
                    tags=item_payload.tags,
                    aliases=item_payload.aliases,
                    version=item_payload.version,
                    deleted_at=item_payload.deleted_at,
                )
            )
        else:
            existing_item.box_id = mapped_box_id
            existing_item.name = item_payload.name
            existing_item.description = item_payload.description
            existing_item.photo_url = item_payload.photo_url
            existing_item.physical_location = item_payload.physical_location
            existing_item.tags = item_payload.tags
            existing_item.aliases = item_payload.aliases
            existing_item.version = item_payload.version
            existing_item.deleted_at = item_payload.deleted_at

        append_change_log(
            db,
            warehouse_id=warehouse_id,
            entity_type="item",
            entity_id=mapped_item_id,
            action="import",
            entity_version=item_payload.version,
            payload={"name": item_payload.name, "box_id": mapped_box_id},
        )
        items_upserted += 1

    stock_movements_upserted = 0
    for movement_payload in payload.stock_movements:
        mapped_item_id = item_id_map.get(movement_payload.item_id, movement_payload.item_id)

        existing_by_command = db.scalar(
            select(StockMovement).where(
                StockMovement.item_id == mapped_item_id,
                StockMovement.command_id == movement_payload.command_id,
            )
        )
        if existing_by_command is not None:
            continue

        item = db.scalar(
            select(Item).where(Item.id == mapped_item_id, Item.warehouse_id == warehouse_id)
        )
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item {movement_payload.item_id} not found for stock movement {movement_payload.id}",
            )

        mapped_movement_id = movement_payload.id
        existing_movement = db.scalar(select(StockMovement).where(StockMovement.id == mapped_movement_id))
        if existing_movement is not None and existing_movement.warehouse_id != warehouse_id:
            mapped_movement_id = str(uuid.uuid4())

        db.add(
            StockMovement(
                id=mapped_movement_id,
                warehouse_id=warehouse_id,
                item_id=mapped_item_id,
                delta=movement_payload.delta,
                command_id=movement_payload.command_id,
                note=movement_payload.note,
            )
        )
        append_change_log(
            db,
            warehouse_id=warehouse_id,
            entity_type="stock",
            entity_id=mapped_item_id,
            action="import",
            payload={"delta": movement_payload.delta, "command_id": movement_payload.command_id},
        )
        stock_movements_upserted += 1

    append_change_log(
        db,
        warehouse_id=warehouse_id,
        entity_type="warehouse",
        entity_id=warehouse_id,
        action="import",
        payload={"updated_by": current_user.id},
    )

    db.commit()

    return WarehouseImportResponse(
        message="Import completed",
        boxes_upserted=boxes_upserted,
        items_upserted=items_upserted,
        stock_movements_upserted=stock_movements_upserted,
    )
