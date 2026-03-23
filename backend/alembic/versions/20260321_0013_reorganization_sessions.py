"""add reorganization_sessions table

Revision ID: 20260321_0013
Revises: 20260307_0012
Create Date: 2026-03-21 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260321_0013"
down_revision = "20260307_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reorganization_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("warehouse_id", sa.String(36), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="running"),
        sa.Column("suggestions", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("error_message", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_reorganization_sessions_warehouse_id", "reorganization_sessions", ["warehouse_id"])
    op.create_index("ix_reorganization_sessions_status", "reorganization_sessions", ["status"])


def downgrade() -> None:
    op.drop_index("ix_reorganization_sessions_status", table_name="reorganization_sessions")
    op.drop_index("ix_reorganization_sessions_warehouse_id", table_name="reorganization_sessions")
    op.drop_table("reorganization_sessions")
