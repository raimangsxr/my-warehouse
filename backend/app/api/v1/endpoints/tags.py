from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_warehouse_membership
from app.db.session import get_db
from app.models.item import Item
from app.schemas.tag import TagCloudEntry, TagResponse

router = APIRouter(prefix="/warehouses/{warehouse_id}/tags", tags=["tags"])


@router.get("", response_model=list[TagResponse])
def list_tags(
    warehouse_id: str,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> list[TagResponse]:
    items = db.scalars(
        select(Item).where(Item.warehouse_id == warehouse_id, Item.deleted_at.is_(None))
    ).all()

    tags = sorted({tag.strip() for item in items for tag in (item.tags or []) if tag and tag.strip()})
    return [TagResponse(name=tag) for tag in tags]


@router.get("/cloud", response_model=list[TagCloudEntry])
def tag_cloud(
    warehouse_id: str,
    _membership=Depends(require_warehouse_membership),
    db: Session = Depends(get_db),
) -> list[TagCloudEntry]:
    items = db.scalars(
        select(Item).where(Item.warehouse_id == warehouse_id, Item.deleted_at.is_(None))
    ).all()

    counts: dict[str, int] = {}
    for item in items:
        for tag in item.tags or []:
            normalized = tag.strip()
            if not normalized:
                continue
            counts[normalized] = counts.get(normalized, 0) + 1

    entries = [TagCloudEntry(tag=tag, count=count) for tag, count in counts.items()]
    entries.sort(key=lambda entry: (-entry.count, entry.tag.lower()))
    return entries
