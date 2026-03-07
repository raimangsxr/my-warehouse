"""add intake draft quantity and llm intake parallelism

Revision ID: 20260307_0012
Revises: 20260305_0011
Create Date: 2026-03-07 10:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260307_0012"
down_revision = "20260305_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "intake_drafts",
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "intake_drafts",
        sa.Column("committed_quantity", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "llm_settings",
        sa.Column("intake_parallelism", sa.Integer(), nullable=False, server_default="4"),
    )


def downgrade() -> None:
    op.drop_column("llm_settings", "intake_parallelism")
    op.drop_column("intake_drafts", "committed_quantity")
    op.drop_column("intake_drafts", "quantity")
