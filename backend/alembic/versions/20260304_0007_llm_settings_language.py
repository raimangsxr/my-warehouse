"""add llm settings language

Revision ID: 20260304_0007
Revises: 20260222_0006
Create Date: 2026-03-04 22:45:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260304_0007"
down_revision = "20260222_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "llm_settings",
        sa.Column("language", sa.String(length=8), nullable=False, server_default="es"),
    )
    op.create_check_constraint(
        "ck_llm_settings_language",
        "llm_settings",
        "language in ('es', 'en')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_llm_settings_language", "llm_settings", type_="check")
    op.drop_column("llm_settings", "language")
