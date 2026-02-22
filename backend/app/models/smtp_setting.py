from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SMTPSetting(TimestampMixin, Base):
    __tablename__ = "smtp_settings"

    warehouse_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("warehouses.id"), primary_key=True
    )
    host: Mapped[str] = mapped_column(String(255))
    port: Mapped[int] = mapped_column(Integer, default=587, nullable=False)
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_encrypted: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    encryption_mode: Mapped[str] = mapped_column(String(32), default="starttls", nullable=False)
    from_address: Mapped[str] = mapped_column(String(255))
    from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
