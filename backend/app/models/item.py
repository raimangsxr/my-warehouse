from datetime import datetime

from sqlalchemy import ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Item(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "items"

    warehouse_id: Mapped[str] = mapped_column(String(36), ForeignKey("warehouses.id"), index=True)
    box_id: Mapped[str] = mapped_column(String(36), ForeignKey("boxes.id"), index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    physical_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    aliases: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True, index=True)

    warehouse = relationship("Warehouse", back_populates="items")
    box = relationship("Box", back_populates="items")
    favorites = relationship("ItemFavorite", back_populates="item", cascade="all, delete-orphan")
    stock_movements = relationship("StockMovement", back_populates="item", cascade="all, delete-orphan")
