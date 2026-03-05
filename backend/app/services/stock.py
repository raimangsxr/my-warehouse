import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.stock_movement import StockMovement

logger = logging.getLogger(__name__)


def initial_stock_command_id(item_id: str) -> str:
    return f"item-create:{item_id}"


def ensure_initial_stock_movement(db: Session, *, warehouse_id: str, item_id: str) -> tuple[str, bool]:
    command_id = initial_stock_command_id(item_id)
    existing = db.scalar(
        select(StockMovement).where(
            StockMovement.item_id == item_id,
            StockMovement.command_id == command_id,
        )
    )
    if existing is not None:
        logger.debug(
            "Initial stock movement already exists warehouse_id=%s item_id=%s command_id=%s",
            warehouse_id,
            item_id,
            command_id,
        )
        return command_id, False

    db.add(
        StockMovement(
            warehouse_id=warehouse_id,
            item_id=item_id,
            delta=1,
            command_id=command_id,
            note="Initial stock on item creation",
        )
    )
    logger.info(
        "Initial stock movement created warehouse_id=%s item_id=%s command_id=%s",
        warehouse_id,
        item_id,
        command_id,
    )
    return command_id, True
