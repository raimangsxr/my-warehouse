"""add suggested_name to intake drafts

Revision ID: 20260305_0010
Revises: 20260305_0009
Create Date: 2026-03-05 16:55:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260305_0010"
down_revision = "20260305_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("intake_drafts", sa.Column("suggested_name", sa.String(length=160), nullable=True))


def downgrade() -> None:
    op.drop_column("intake_drafts", "suggested_name")
