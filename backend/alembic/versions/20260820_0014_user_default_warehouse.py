"""add user default warehouse

Revision ID: 20260820_0014
Revises: 20260820_0013
Create Date: 2026-08-20 16:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260820_0014"
down_revision = "20260820_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("default_warehouse_id", sa.String(length=36), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_users_default_warehouse_id_warehouses",
            "warehouses",
            ["default_warehouse_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index(
            "ix_users_default_warehouse_id",
            ["default_warehouse_id"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_index("ix_users_default_warehouse_id")
        batch_op.drop_constraint(
            "fk_users_default_warehouse_id_warehouses",
            type_="foreignkey",
        )
        batch_op.drop_column("default_warehouse_id")
