from sqlalchemy import CheckConstraint, ForeignKey, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


WAREHOUSE_ROLE_ADMINISTRATOR = "administrator"
WAREHOUSE_ROLE_CONTRIBUTOR = "contributor"
WAREHOUSE_ROLES = (WAREHOUSE_ROLE_ADMINISTRATOR, WAREHOUSE_ROLE_CONTRIBUTOR)


class Membership(TimestampMixin, Base):
    __tablename__ = "memberships"
    __table_args__ = (
        PrimaryKeyConstraint("user_id", "warehouse_id"),
        CheckConstraint(
            "role IN ('administrator', 'contributor')",
            name="ck_memberships_role",
        ),
    )

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(36), ForeignKey("warehouses.id"), nullable=False)
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=WAREHOUSE_ROLE_CONTRIBUTOR,
        server_default=WAREHOUSE_ROLE_CONTRIBUTOR,
    )

    user = relationship("User", back_populates="memberships")
    warehouse = relationship("Warehouse", back_populates="memberships")
