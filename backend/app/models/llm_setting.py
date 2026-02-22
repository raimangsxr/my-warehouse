from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class LLMSetting(TimestampMixin, Base):
    __tablename__ = "llm_settings"

    warehouse_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("warehouses.id"), primary_key=True
    )
    provider: Mapped[str] = mapped_column(String(32), default="gemini", nullable=False)
    api_key_encrypted: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    auto_tags_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_alias_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
