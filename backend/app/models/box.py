from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Box(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "boxes"

    warehouse_id: Mapped[str] = mapped_column(String(36), ForeignKey("warehouses.id"), index=True)
    parent_box_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("boxes.id"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    physical_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    qr_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    short_code: Mapped[str] = mapped_column(String(16), index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True, index=True)

    warehouse = relationship("Warehouse", back_populates="boxes")
    parent = relationship("Box", remote_side="Box.id", back_populates="children")
    children = relationship("Box", back_populates="parent")
    items = relationship("Item", back_populates="box")
