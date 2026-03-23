from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ReorganizationSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reorganization_sessions"

    warehouse_id: Mapped[str] = mapped_column(String(36), ForeignKey("warehouses.id"), index=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(24), default="running", nullable=False, index=True)
    suggestions: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)

    warehouse = relationship("Warehouse")
    creator = relationship("User")
