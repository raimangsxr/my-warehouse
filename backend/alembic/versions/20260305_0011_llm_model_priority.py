"""add llm model priority

Revision ID: 20260305_0011
Revises: 20260305_0010
Create Date: 2026-03-05 19:05:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260305_0011"
down_revision = "20260305_0010"
branch_labels = None
depends_on = None


DEFAULT_MODEL_PRIORITY_JSON = (
    '["gemini-3.1-flash-lite","gemini-3-flash","gemini-2.5-flash","gemini-2.5-flash-lite"]'
)


def upgrade() -> None:
    op.add_column(
        "llm_settings",
        sa.Column(
            "model_priority",
            sa.JSON(),
            nullable=False,
            server_default=sa.text(f"'{DEFAULT_MODEL_PRIORITY_JSON}'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("llm_settings", "model_priority")
