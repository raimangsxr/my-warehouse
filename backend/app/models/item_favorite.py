from sqlalchemy import ForeignKey, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ItemFavorite(TimestampMixin, Base):
    __tablename__ = "item_favorites"
    __table_args__ = (PrimaryKeyConstraint("user_id", "item_id"),)

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    item_id: Mapped[str] = mapped_column(String(36), ForeignKey("items.id"), nullable=False)

    user = relationship("User", back_populates="favorite_items")
    item = relationship("Item", back_populates="favorites")
