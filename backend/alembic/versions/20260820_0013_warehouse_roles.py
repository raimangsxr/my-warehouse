"""add warehouse membership and invitation roles

Revision ID: 20260820_0013
Revises: 20260307_0012
Create Date: 2026-08-20 12:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260820_0013"
down_revision = "20260307_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("memberships") as batch_op:
        batch_op.add_column(
            sa.Column(
                "role",
                sa.String(length=20),
                nullable=False,
                server_default="contributor",
            )
        )

    op.execute(
        sa.text(
            """
            UPDATE memberships
            SET role = 'administrator'
            WHERE EXISTS (
                SELECT 1
                FROM warehouses
                WHERE warehouses.id = memberships.warehouse_id
                  AND warehouses.created_by = memberships.user_id
            )
            """
        )
    )

    with op.batch_alter_table("memberships") as batch_op:
        batch_op.create_check_constraint(
            "ck_memberships_role",
            "role IN ('administrator', 'contributor')",
        )

    with op.batch_alter_table("warehouse_invites") as batch_op:
        batch_op.add_column(
            sa.Column(
                "role",
                sa.String(length=20),
                nullable=False,
                server_default="contributor",
            )
        )
        batch_op.create_check_constraint(
            "ck_warehouse_invites_role",
            "role IN ('administrator', 'contributor')",
        )


def downgrade() -> None:
    with op.batch_alter_table("warehouse_invites") as batch_op:
        batch_op.drop_constraint("ck_warehouse_invites_role", type_="check")
        batch_op.drop_column("role")

    with op.batch_alter_table("memberships") as batch_op:
        batch_op.drop_constraint("ck_memberships_role", type_="check")
        batch_op.drop_column("role")
