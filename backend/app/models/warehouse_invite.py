from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.membership import WAREHOUSE_ROLE_CONTRIBUTOR


class WarehouseInvite(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "warehouse_invites"
    __table_args__ = (
        CheckConstraint(
            "role IN ('administrator', 'contributor')",
            name="ck_warehouse_invites_role",
        ),
    )

    warehouse_id: Mapped[str] = mapped_column(String(36), ForeignKey("warehouses.id"), index=True)
    invited_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    invitee_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=WAREHOUSE_ROLE_CONTRIBUTOR,
        server_default=WAREHOUSE_ROLE_CONTRIBUTOR,
    )
