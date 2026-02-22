from datetime import UTC, datetime
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_warehouse_membership
from app.db.session import get_db
from app.models.box import Box
from app.models.item import Item
from app.models.membership import Membership
from app.models.stock_movement import StockMovement
from app.models.user import User
from app.schemas.box import (
    BoxByQrResponse,
    BoxCreateRequest,
    BoxDeleteRequest,
    BoxItemResponse,
    BoxMoveRequest,
    BoxResponse,
    BoxTreeNode,
    BoxUpdateRequest,
)
from app.schemas.common import MessageResponse
from app.services.activity import record_activity

router = APIRouter(prefix="/warehouses/{warehouse_id}/boxes", tags=["boxes"])
qr_router = APIRouter(prefix="/boxes", tags=["boxes"])


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


def _build_box_maps(db: Session, warehouse_id: str, include_deleted: bool = False) -> tuple[dict[str, Box], dict[str | None, list[str]]]:
    query = select(Box).where(Box.warehouse_id == warehouse_id)
    if not include_deleted:
        query = query.where(Box.deleted_at.is_(None))
    boxes = db.scalars(query).all()
    by_id = {box.id: box for box in boxes}
    children: dict[str | None, list[str]] = {}
    for box in boxes:
        children.setdefault(box.parent_box_id, []).append(box.id)
    return by_id, children


def _collect_descendant_ids(root_id: str, children: dict[str | None, list[str]]) -> set[str]:
    stack = [root_id]
    descendants: set[str] = set()
    while stack:
        current = stack.pop()
        if current in descendants:
            continue
        descendants.add(current)
        stack.extend(children.get(current, []))
    return descendants


def _next_default_name(db: Session, warehouse_id: str) -> str:
    count = db.scalar(select(func.count(Box.id)).where(Box.warehouse_id == warehouse_id))
    next_idx = (count or 0) + 1
    return f"Caja {next_idx}"


def _new_short_code() -> str:
    return f"BX-{secrets.token_hex(3).upper()}"


def _new_qr_token() -> str:
    return secrets.token_urlsafe(24)


def _compute_recursive_counts(
    boxes: dict[str, Box], children: dict[str | None, list[str]], warehouse_items: list[Item]
) -> tuple[dict[str, int], dict[str, int]]:
    direct_items: dict[str, int] = {}
    for item in warehouse_items:
        direct_items[item.box_id] = direct_items.get(item.box_id, 0) + 1

    item_counts: dict[str, int] = {}
    box_counts: dict[str, int] = {}

    def walk(box_id: str) -> tuple[int, int]:
        if box_id in item_counts and box_id in box_counts:
            return item_counts[box_id], box_counts[box_id]

        total_items = direct_items.get(box_id, 0)
        total_boxes = 0
        for child_id in children.get(box_id, []):
            child_items, child_boxes = walk(child_id)
            total_items += child_items
            total_boxes += 1 + child_boxes

        item_counts[box_id] = total_items
        box_counts[box_id] = total_boxes
        return total_items, total_boxes

    for box_id in boxes:
        walk(box_id)

    return item_counts, box_counts


def _stock_map(db: Session, item_ids: list[str]) -> dict[str, int]:
    if not item_ids:
        return {}
    rows = db.execute(
        select(StockMovement.item_id, func.coalesce(func.sum(StockMovement.delta), 0))
        .where(StockMovement.item_id.in_(item_ids))
        .group_by(StockMovement.item_id)
    ).all()
    return {item_id: int(stock) for item_id, stock in rows}


def _box_path(warehouse_boxes: dict[str, Box], box_id: str) -> list[str]:
    path: list[str] = []
    cursor = box_id
    safe_guard = 0
    while cursor and safe_guard < 128:
        safe_guard += 1
        box = warehouse_boxes.get(cursor)
        if box is None:
            break
        path.append(box.name)
        cursor = box.parent_box_id
    path.reverse()
    return path


def _box_path_ids(warehouse_boxes: dict[str, Box], box_id: str) -> list[str]:
    path: list[str] = []
    cursor = box_id
    safe_guard = 0
    while cursor and safe_guard < 128:
        safe_guard += 1
        box = warehouse_boxes.get(cursor)
        if box is None:
            break
        path.append(box.id)
        cursor = box.parent_box_id
    path.reverse()
    return path


@router.get("/tree", response_model=list[BoxTreeNode])
def get_tree(
    warehouse_id: str,
    include_deleted: bool = False,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> list[BoxTreeNode]:
    boxes, children = _build_box_maps(db, warehouse_id, include_deleted=include_deleted)
    items = db.scalars(
        select(Item).where(Item.warehouse_id == warehouse_id, Item.deleted_at.is_(None))
    ).all()
    item_counts, box_counts = _compute_recursive_counts(boxes, children, items)

    ordered_nodes: list[BoxTreeNode] = []

    def visit(node_id: str, level: int) -> None:
        box = boxes[node_id]
        ordered_nodes.append(
            BoxTreeNode(
                box=BoxResponse.model_validate(box),
                level=level,
                total_items_recursive=item_counts.get(node_id, 0),
                total_boxes_recursive=box_counts.get(node_id, 0),
            )
        )
        for child_id in sorted(children.get(node_id, []), key=lambda cid: boxes[cid].name.lower()):
            visit(child_id, level + 1)

    roots = sorted(children.get(None, []), key=lambda cid: boxes[cid].name.lower())
    for root_id in roots:
        visit(root_id, 0)

    return ordered_nodes


@router.post("", response_model=BoxResponse, status_code=status.HTTP_201_CREATED)
def create_box(
    warehouse_id: str,
    payload: BoxCreateRequest,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BoxResponse:
    if payload.parent_box_id:
        _get_box(db, warehouse_id, payload.parent_box_id)

    name = payload.name.strip() if payload.name else _next_default_name(db, warehouse_id)
    box = Box(
        warehouse_id=warehouse_id,
        parent_box_id=payload.parent_box_id,
        name=name,
        description=payload.description,
        physical_location=payload.physical_location,
        qr_token=_new_qr_token(),
        short_code=_new_short_code(),
    )
    db.add(box)
    record_activity(
        db,
        warehouse_id=warehouse_id,
        actor_user_id=current_user.id,
        event_type="box.created",
        entity_type="box",
        entity_id=box.id,
        metadata={"name": box.name},
    )
    db.commit()
    db.refresh(box)
    return BoxResponse.model_validate(box)


@router.get("/{box_id}", response_model=BoxResponse)
def get_box(
    warehouse_id: str,
    box_id: str,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> BoxResponse:
    box = _get_box(db, warehouse_id, box_id)
    return BoxResponse.model_validate(box)


@router.get("/{box_id}/items", response_model=list[BoxItemResponse])
def get_box_items_recursive(
    warehouse_id: str,
    box_id: str,
    q: str | None = None,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> list[BoxItemResponse]:
    _get_box(db, warehouse_id, box_id)
    boxes, children = _build_box_maps(db, warehouse_id)
    subtree_ids = _collect_descendant_ids(box_id, children)

    query = select(Item).where(
        Item.warehouse_id == warehouse_id,
        Item.box_id.in_(subtree_ids),
        Item.deleted_at.is_(None),
    )
    if q:
        needle = f"%{q.strip().lower()}%"
        query = query.where(func.lower(Item.name).like(needle))
    items = db.scalars(query.order_by(Item.name.asc())).all()
    stocks = _stock_map(db, [item.id for item in items])

    return [
        BoxItemResponse(
            id=item.id,
            box_id=item.box_id,
            name=item.name,
            description=item.description,
            physical_location=item.physical_location,
            stock=stocks.get(item.id, 0),
            box_path=_box_path(boxes, item.box_id),
            box_path_ids=_box_path_ids(boxes, item.box_id),
        )
        for item in items
    ]


@router.patch("/{box_id}", response_model=BoxResponse)
def update_box(
    warehouse_id: str,
    box_id: str,
    payload: BoxUpdateRequest,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> BoxResponse:
    box = _get_box(db, warehouse_id, box_id)

    changed = False
    if payload.name is not None:
        box.name = payload.name.strip()
        changed = True
    if payload.description is not None:
        box.description = payload.description
        changed = True
    if payload.physical_location is not None:
        box.physical_location = payload.physical_location
        changed = True

    if changed:
        box.version += 1
        db.commit()
        db.refresh(box)

    return BoxResponse.model_validate(box)


@router.post("/{box_id}/move", response_model=BoxResponse)
def move_box(
    warehouse_id: str,
    box_id: str,
    payload: BoxMoveRequest,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> BoxResponse:
    box = _get_box(db, warehouse_id, box_id)

    if payload.new_parent_box_id == box_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Box cannot be parent of itself")

    if payload.new_parent_box_id:
        _get_box(db, warehouse_id, payload.new_parent_box_id)

    boxes, children = _build_box_maps(db, warehouse_id)
    descendants = _collect_descendant_ids(box_id, children)
    if payload.new_parent_box_id and payload.new_parent_box_id in descendants:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot move box into a descendant")

    box.parent_box_id = payload.new_parent_box_id
    box.version += 1
    db.commit()
    db.refresh(box)
    return BoxResponse.model_validate(box)


@router.delete("/{box_id}", response_model=MessageResponse)
def delete_box(
    warehouse_id: str,
    box_id: str,
    payload: BoxDeleteRequest,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    _get_box(db, warehouse_id, box_id)
    boxes, children = _build_box_maps(db, warehouse_id)
    subtree_ids = _collect_descendant_ids(box_id, children)

    has_children = len(children.get(box_id, [])) > 0
    has_items = db.scalar(
        select(func.count(Item.id)).where(
            Item.warehouse_id == warehouse_id,
            Item.box_id.in_(subtree_ids),
            Item.deleted_at.is_(None),
        )
    )
    if (has_children or (has_items or 0) > 0) and not payload.force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Box has nested content. Repeat with force=true to soft-delete recursively.",
        )

    now = utcnow()
    for sub_box_id in subtree_ids:
        sub_box = boxes[sub_box_id]
        if sub_box.deleted_at is None:
            sub_box.deleted_at = now
            sub_box.version += 1

    items = db.scalars(
        select(Item).where(Item.warehouse_id == warehouse_id, Item.box_id.in_(subtree_ids), Item.deleted_at.is_(None))
    ).all()
    for item in items:
        item.deleted_at = now
        item.version += 1

    record_activity(
        db,
        warehouse_id=warehouse_id,
        actor_user_id=current_user.id,
        event_type="box.deleted",
        entity_type="box",
        entity_id=box_id,
        metadata={"recursive_boxes": len(subtree_ids), "recursive_items": len(items)},
    )
    db.commit()
    return MessageResponse(message="Box moved to trash")


@router.post("/{box_id}/restore", response_model=BoxResponse)
def restore_box(
    warehouse_id: str,
    box_id: str,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BoxResponse:
    box = _get_box(db, warehouse_id, box_id, include_deleted=True)
    if box.deleted_at is None:
        return BoxResponse.model_validate(box)

    if box.parent_box_id:
        parent = _get_box(db, warehouse_id, box.parent_box_id, include_deleted=True)
        if parent.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Restore parent box first",
            )

    box.deleted_at = None
    box.version += 1
    record_activity(
        db,
        warehouse_id=warehouse_id,
        actor_user_id=current_user.id,
        event_type="box.restored",
        entity_type="box",
        entity_id=box.id,
        metadata={"name": box.name},
    )
    db.commit()
    db.refresh(box)
    return BoxResponse.model_validate(box)


@qr_router.get("/by-qr/{qr_token}", response_model=BoxByQrResponse)
def get_box_by_qr(
    qr_token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BoxByQrResponse:
    box = db.scalar(select(Box).where(Box.qr_token == qr_token, Box.deleted_at.is_(None)))
    if box is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR not found")

    membership = db.scalar(
        select(Membership).where(
            Membership.user_id == current_user.id,
            Membership.warehouse_id == box.warehouse_id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to warehouse")

    return BoxByQrResponse(
        box_id=box.id,
        warehouse_id=box.warehouse_id,
        short_code=box.short_code,
        name=box.name,
    )
