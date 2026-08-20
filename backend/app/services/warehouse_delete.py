import logging
import shutil
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.activity_event import ActivityEvent
from app.models.box import Box
from app.models.change_log import ChangeLog
from app.models.intake_batch import IntakeBatch
from app.models.intake_draft import IntakeDraft
from app.models.item import Item
from app.models.item_favorite import ItemFavorite
from app.models.llm_setting import LLMSetting
from app.models.membership import Membership, WAREHOUSE_ROLE_ADMINISTRATOR
from app.models.processed_command import ProcessedCommand
from app.models.smtp_setting import SMTPSetting
from app.models.stock_movement import StockMovement
from app.models.sync_conflict import SyncConflict
from app.models.user import User
from app.models.warehouse import Warehouse
from app.models.warehouse_invite import WarehouseInvite

logger = logging.getLogger(__name__)


class WarehouseDeletionFailedError(Exception):
    """Raised when filesystem cleanup fails after database deletes are staged."""


def assert_can_delete_warehouse(
    db: Session,
    warehouse_id: str,
    user_id: str,
    confirm_name: str,
) -> Warehouse:
    warehouse = db.scalar(select(Warehouse).where(Warehouse.id == warehouse_id))
    if warehouse is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    membership = db.scalar(
        select(Membership).where(
            Membership.warehouse_id == warehouse_id,
            Membership.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")

    if membership.role != WAREHOUSE_ROLE_ADMINISTRATOR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator role required",
        )

    if confirm_name != warehouse.name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation name does not match warehouse name",
        )

    processing_batch = db.scalar(
        select(IntakeBatch.id)
        .where(
            IntakeBatch.warehouse_id == warehouse_id,
            IntakeBatch.status == "processing",
        )
        .limit(1)
    )
    if processing_batch is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete warehouse while intake batches are processing",
        )

    return warehouse


def _delete_warehouse_rows(db: Session, warehouse_id: str) -> None:
    db.execute(
        update(User)
        .where(User.default_warehouse_id == warehouse_id)
        .values(default_warehouse_id=None)
    )
    item_ids = select(Item.id).where(Item.warehouse_id == warehouse_id)
    db.execute(delete(ItemFavorite).where(ItemFavorite.item_id.in_(item_ids)))
    db.execute(delete(StockMovement).where(StockMovement.warehouse_id == warehouse_id))
    db.execute(delete(ChangeLog).where(ChangeLog.warehouse_id == warehouse_id))
    db.execute(delete(ProcessedCommand).where(ProcessedCommand.warehouse_id == warehouse_id))
    db.execute(delete(SyncConflict).where(SyncConflict.warehouse_id == warehouse_id))
    db.execute(delete(IntakeDraft).where(IntakeDraft.warehouse_id == warehouse_id))
    db.execute(delete(IntakeBatch).where(IntakeBatch.warehouse_id == warehouse_id))
    db.execute(delete(Item).where(Item.warehouse_id == warehouse_id))
    db.execute(update(Box).where(Box.warehouse_id == warehouse_id).values(parent_box_id=None))
    db.execute(delete(Box).where(Box.warehouse_id == warehouse_id))
    db.execute(delete(ActivityEvent).where(ActivityEvent.warehouse_id == warehouse_id))
    db.execute(delete(WarehouseInvite).where(WarehouseInvite.warehouse_id == warehouse_id))
    db.execute(delete(SMTPSetting).where(SMTPSetting.warehouse_id == warehouse_id))
    db.execute(delete(LLMSetting).where(LLMSetting.warehouse_id == warehouse_id))
    db.execute(delete(Membership).where(Membership.warehouse_id == warehouse_id))
    db.execute(delete(Warehouse).where(Warehouse.id == warehouse_id))


def delete_warehouse(db: Session, warehouse: Warehouse, actor_user_id: str) -> None:
    warehouse_id = warehouse.id
    warehouse_name = warehouse.name
    media_path = Path(settings.media_root) / warehouse_id

    try:
        _delete_warehouse_rows(db, warehouse_id)
        db.flush()

        if media_path.exists():
            shutil.rmtree(media_path)

        logger.info(
            "Warehouse deleted warehouse_id=%s name=%s actor_user_id=%s",
            warehouse_id,
            warehouse_name,
            actor_user_id,
        )
        db.commit()
    except OSError as exc:
        db.rollback()
        logger.error("Warehouse media deletion failed warehouse_id=%s", warehouse_id)
        raise WarehouseDeletionFailedError from exc
    except Exception:
        db.rollback()
        raise
