from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_warehouse_membership
from app.db.session import get_db
from app.models.box import Box
from app.models.item import Item
from app.models.item_favorite import ItemFavorite
from app.models.stock_movement import StockMovement
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.item import (
    ItemBatchAction,
    ItemBatchRequest,
    ItemCreateRequest,
    ItemFavoriteRequest,
    ItemResponse,
    ItemUpdateRequest,
    StockAdjustRequest,
)

router = APIRouter(prefix="/warehouses/{warehouse_id}/items", tags=["items"])


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


def _get_item(db: Session, warehouse_id: str, item_id: str, include_deleted: bool = False) -> Item:
    query = select(Item).where(Item.id == item_id, Item.warehouse_id == warehouse_id)
    if not include_deleted:
        query = query.where(Item.deleted_at.is_(None))
    item = db.scalar(query)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


def _stock_map(db: Session, item_ids: list[str]) -> dict[str, int]:
    if not item_ids:
        return {}
    rows = db.execute(
        select(StockMovement.item_id, func.coalesce(func.sum(StockMovement.delta), 0))
        .where(StockMovement.item_id.in_(item_ids))
        .group_by(StockMovement.item_id)
    ).all()
    return {item_id: int(stock) for item_id, stock in rows}


def _favorite_set(db: Session, user_id: str, item_ids: list[str]) -> set[str]:
    if not item_ids:
        return set()
    rows = db.scalars(
        select(ItemFavorite.item_id).where(
            ItemFavorite.user_id == user_id,
            ItemFavorite.item_id.in_(item_ids),
        )
    ).all()
    return set(rows)


def _active_boxes_map(db: Session, warehouse_id: str) -> dict[str, Box]:
    boxes = db.scalars(select(Box).where(Box.warehouse_id == warehouse_id, Box.deleted_at.is_(None))).all()
    return {box.id: box for box in boxes}


def _box_path_from_map(boxes_by_id: dict[str, Box], box_id: str) -> list[str]:
    path: list[str] = []
    cursor = box_id
    safe_guard = 0
    while cursor and safe_guard < 128:
        safe_guard += 1
        node = boxes_by_id.get(cursor)
        if node is None:
            break
        path.append(node.name)
        cursor = node.parent_box_id
    path.reverse()
    return path


def _search_relevance_score(item: Item, normalized_q: str, path_text: str) -> int:
    name = item.name.lower()
    aliases = [alias.lower() for alias in (item.aliases or [])]
    tags = [tag.lower() for tag in (item.tags or [])]
    description = (item.description or "").lower()
    location = (item.physical_location or "").lower()

    if name == normalized_q:
        return 100
    if name.startswith(normalized_q):
        return 90
    if normalized_q in name:
        return 80
    if any(alias == normalized_q or normalized_q in alias for alias in aliases):
        return 70
    if any(tag == normalized_q or normalized_q in tag for tag in tags):
        return 60
    if normalized_q in description or normalized_q in path_text or normalized_q in location:
        return 50
    return 0


def _serialize_item(
    boxes_by_id: dict[str, Box],
    item: Item,
    stock: int,
    favorite: bool,
) -> ItemResponse:
    return ItemResponse(
        id=item.id,
        warehouse_id=item.warehouse_id,
        box_id=item.box_id,
        name=item.name,
        description=item.description,
        photo_url=item.photo_url,
        physical_location=item.physical_location,
        tags=item.tags or [],
        aliases=item.aliases or [],
        version=item.version,
        created_at=item.created_at,
        updated_at=item.updated_at,
        deleted_at=item.deleted_at,
        stock=stock,
        is_favorite=favorite,
        box_path=_box_path_from_map(boxes_by_id, item.box_id),
    )


@router.get("", response_model=list[ItemResponse])
def list_items(
    warehouse_id: str,
    q: str | None = None,
    tag: str | None = None,
    favorites_only: bool = False,
    stock_zero: bool = False,
    with_photo: bool | None = None,
    include_deleted: bool = False,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ItemResponse]:
    query = select(Item).where(Item.warehouse_id == warehouse_id)
    if not include_deleted:
        query = query.where(Item.deleted_at.is_(None))

    if with_photo is True:
        query = query.where(Item.photo_url.is_not(None))
    if with_photo is False:
        query = query.where(Item.photo_url.is_(None))

    items = db.scalars(query).all()
    boxes_by_id = _active_boxes_map(db, warehouse_id)
    path_cache = {item.id: _box_path_from_map(boxes_by_id, item.box_id) for item in items}

    if tag and tag.strip():
        normalized_tag = tag.strip().lower()
        items = [
            item
            for item in items
            if any(existing_tag.lower() == normalized_tag for existing_tag in (item.tags or []))
        ]

    if q and q.strip():
        normalized_q = q.strip().lower()
        ranked: list[tuple[int, Item]] = []
        for item in items:
            path_text = " > ".join(path_cache[item.id]).lower()
            score = _search_relevance_score(item, normalized_q, path_text)
            if score > 0:
                ranked.append((score, item))
        ranked.sort(key=lambda row: (-row[0], row[1].name.lower(), -row[1].created_at.timestamp()))
        items = [item for _, item in ranked]
    else:
        items = sorted(items, key=lambda item: item.created_at, reverse=True)

    item_ids = [item.id for item in items]
    stocks = _stock_map(db, item_ids)
    favorites = _favorite_set(db, current_user.id, item_ids)

    serialized = [
        _serialize_item(
            boxes_by_id,
            item,
            stock=stocks.get(item.id, 0),
            favorite=item.id in favorites,
        )
        for item in items
    ]

    if favorites_only:
        serialized = [item for item in serialized if item.is_favorite]
    if stock_zero:
        serialized = [item for item in serialized if item.stock == 0]

    return serialized


@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    warehouse_id: str,
    payload: ItemCreateRequest,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    _get_active_box(db, warehouse_id, payload.box_id)

    item = Item(
        warehouse_id=warehouse_id,
        box_id=payload.box_id,
        name=payload.name.strip(),
        description=payload.description,
        photo_url=payload.photo_url,
        physical_location=payload.physical_location,
        tags=payload.tags,
        aliases=payload.aliases,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    boxes_by_id = _active_boxes_map(db, warehouse_id)
    return _serialize_item(boxes_by_id, item, stock=0, favorite=False)


@router.get("/{item_id}", response_model=ItemResponse)
def get_item(
    warehouse_id: str,
    item_id: str,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    item = _get_item(db, warehouse_id, item_id)
    stock = _stock_map(db, [item.id]).get(item.id, 0)
    favorite = item.id in _favorite_set(db, current_user.id, [item.id])
    boxes_by_id = _active_boxes_map(db, warehouse_id)
    return _serialize_item(boxes_by_id, item, stock=stock, favorite=favorite)


@router.patch("/{item_id}", response_model=ItemResponse)
def update_item(
    warehouse_id: str,
    item_id: str,
    payload: ItemUpdateRequest,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    item = _get_item(db, warehouse_id, item_id)

    changed = False
    if payload.box_id is not None:
        _get_active_box(db, warehouse_id, payload.box_id)
        item.box_id = payload.box_id
        changed = True
    if payload.name is not None:
        item.name = payload.name.strip()
        changed = True
    if payload.description is not None:
        item.description = payload.description
        changed = True
    if payload.photo_url is not None:
        item.photo_url = payload.photo_url
        changed = True
    if payload.physical_location is not None:
        item.physical_location = payload.physical_location
        changed = True
    if payload.tags is not None:
        item.tags = payload.tags
        changed = True
    if payload.aliases is not None:
        item.aliases = payload.aliases
        changed = True

    if changed:
        item.version += 1
        db.commit()
        db.refresh(item)

    stock = _stock_map(db, [item.id]).get(item.id, 0)
    favorite = item.id in _favorite_set(db, current_user.id, [item.id])
    boxes_by_id = _active_boxes_map(db, warehouse_id)
    return _serialize_item(boxes_by_id, item, stock=stock, favorite=favorite)


@router.delete("/{item_id}", response_model=MessageResponse)
def delete_item(
    warehouse_id: str,
    item_id: str,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> MessageResponse:
    item = _get_item(db, warehouse_id, item_id)
    item.deleted_at = utcnow()
    item.version += 1
    db.commit()
    return MessageResponse(message="Item moved to trash")


@router.post("/{item_id}/restore", response_model=ItemResponse)
def restore_item(
    warehouse_id: str,
    item_id: str,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    item = _get_item(db, warehouse_id, item_id, include_deleted=True)
    _get_active_box(db, warehouse_id, item.box_id)

    if item.deleted_at is not None:
        item.deleted_at = None
        item.version += 1
        db.commit()
        db.refresh(item)

    stock = _stock_map(db, [item.id]).get(item.id, 0)
    favorite = item.id in _favorite_set(db, current_user.id, [item.id])
    boxes_by_id = _active_boxes_map(db, warehouse_id)
    return _serialize_item(boxes_by_id, item, stock=stock, favorite=favorite)


@router.post("/{item_id}/favorite", response_model=ItemResponse)
def set_favorite(
    warehouse_id: str,
    item_id: str,
    payload: ItemFavoriteRequest,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    item = _get_item(db, warehouse_id, item_id)
    existing = db.scalar(
        select(ItemFavorite).where(ItemFavorite.user_id == current_user.id, ItemFavorite.item_id == item_id)
    )

    if payload.is_favorite and existing is None:
        db.add(ItemFavorite(user_id=current_user.id, item_id=item_id))
    if not payload.is_favorite and existing is not None:
        db.delete(existing)
    db.commit()

    stock = _stock_map(db, [item.id]).get(item.id, 0)
    boxes_by_id = _active_boxes_map(db, warehouse_id)
    return _serialize_item(boxes_by_id, item, stock=stock, favorite=payload.is_favorite)


@router.post("/{item_id}/stock/adjust", response_model=ItemResponse)
def adjust_stock(
    warehouse_id: str,
    item_id: str,
    payload: StockAdjustRequest,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ItemResponse:
    if payload.delta not in (-1, 1):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="delta must be +1 or -1")

    item = _get_item(db, warehouse_id, item_id)

    existing = db.scalar(
        select(StockMovement).where(
            StockMovement.item_id == item_id,
            StockMovement.command_id == payload.command_id,
        )
    )
    if existing is None:
        db.add(
            StockMovement(
                warehouse_id=warehouse_id,
                item_id=item_id,
                delta=payload.delta,
                command_id=payload.command_id,
                note=payload.note,
            )
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()

    stock = _stock_map(db, [item.id]).get(item.id, 0)
    favorite = item.id in _favorite_set(db, current_user.id, [item.id])
    boxes_by_id = _active_boxes_map(db, warehouse_id)
    return _serialize_item(boxes_by_id, item, stock=stock, favorite=favorite)


@router.post("/batch", response_model=MessageResponse)
def batch_action(
    warehouse_id: str,
    payload: ItemBatchRequest,
    _membership=Depends(require_warehouse_membership),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    unique_ids = list(dict.fromkeys(payload.item_ids))
    items = db.scalars(
        select(Item).where(
            Item.warehouse_id == warehouse_id,
            Item.id.in_(unique_ids),
            Item.deleted_at.is_(None),
        )
    ).all()

    if len(items) != len(unique_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Some items are not available")

    if payload.action == ItemBatchAction.move:
        if not payload.target_box_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="target_box_id is required")
        _get_active_box(db, warehouse_id, payload.target_box_id)
        for item in items:
            item.box_id = payload.target_box_id
            item.version += 1

    elif payload.action == ItemBatchAction.favorite:
        existing = set(
            db.scalars(
                select(ItemFavorite.item_id).where(
                    ItemFavorite.user_id == current_user.id,
                    ItemFavorite.item_id.in_(unique_ids),
                )
            ).all()
        )
        for item_id in unique_ids:
            if item_id not in existing:
                db.add(ItemFavorite(user_id=current_user.id, item_id=item_id))

    elif payload.action == ItemBatchAction.unfavorite:
        db.execute(
            delete(ItemFavorite).where(
                ItemFavorite.user_id == current_user.id,
                ItemFavorite.item_id.in_(unique_ids),
            )
        )

    elif payload.action == ItemBatchAction.delete:
        now = utcnow()
        for item in items:
            item.deleted_at = now
            item.version += 1

    db.commit()
    return MessageResponse(message=f"Batch action '{payload.action.value}' applied to {len(unique_ids)} items")
