from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Warehouse(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "warehouses"

    name: Mapped[str] = mapped_column(String(120))
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)

    memberships = relationship("Membership", back_populates="warehouse", cascade="all, delete-orphan")
    boxes = relationship("Box", back_populates="warehouse", cascade="all, delete-orphan")
    items = relationship("Item", back_populates="warehouse", cascade="all, delete-orphan")
