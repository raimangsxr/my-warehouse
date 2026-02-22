from sqlalchemy import ForeignKey, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Membership(TimestampMixin, Base):
    __tablename__ = "memberships"
    __table_args__ = (PrimaryKeyConstraint("user_id", "warehouse_id"),)

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(36), ForeignKey("warehouses.id"), nullable=False)

    user = relationship("User", back_populates="memberships")
    warehouse = relationship("Warehouse", back_populates="memberships")
