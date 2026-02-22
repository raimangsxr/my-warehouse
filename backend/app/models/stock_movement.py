from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class StockMovement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "stock_movements"
    __table_args__ = (UniqueConstraint("item_id", "command_id", name="uq_stock_movements_item_command"),)

    warehouse_id: Mapped[str] = mapped_column(String(36), ForeignKey("warehouses.id"), index=True)
    item_id: Mapped[str] = mapped_column(String(36), ForeignKey("items.id"), index=True)
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    command_id: Mapped[str] = mapped_column(String(64), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    item = relationship("Item", back_populates="stock_movements")
