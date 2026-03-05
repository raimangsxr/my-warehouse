from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class IntakeDraft(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "intake_drafts"

    warehouse_id: Mapped[str] = mapped_column(String(36), ForeignKey("warehouses.id"), index=True)
    batch_id: Mapped[str] = mapped_column(String(36), ForeignKey("intake_batches.id"), index=True)
    photo_url: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="uploaded", nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    suggested_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    aliases: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    warnings: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    llm_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    processing_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_item_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("items.id"), nullable=True, index=True)

    batch = relationship("IntakeBatch", back_populates="drafts")
    created_item = relationship("Item")
