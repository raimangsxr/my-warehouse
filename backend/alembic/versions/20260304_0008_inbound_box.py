"""add inbound box flag

Revision ID: 20260304_0008
Revises: 20260304_0007
Create Date: 2026-03-04 23:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260304_0008"
down_revision = "20260304_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "boxes",
        sa.Column("is_inbound", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_boxes_is_inbound", "boxes", ["is_inbound"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_boxes_is_inbound", table_name="boxes")
    op.drop_column("boxes", "is_inbound")
