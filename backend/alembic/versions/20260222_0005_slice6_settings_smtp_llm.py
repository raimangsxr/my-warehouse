"""slice6 settings smtp llm

Revision ID: 20260222_0005
Revises: 20260222_0004
Create Date: 2026-02-22 14:55:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260222_0005"
down_revision = "20260222_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "smtp_settings",
        sa.Column("warehouse_id", sa.String(length=36), primary_key=True),
        sa.Column("host", sa.String(length=255), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False, server_default="587"),
        sa.Column("username", sa.String(length=255), nullable=True),
        sa.Column("password_encrypted", sa.String(length=4096), nullable=True),
        sa.Column("encryption_mode", sa.String(length=32), nullable=False, server_default="starttls"),
        sa.Column("from_address", sa.String(length=255), nullable=False),
        sa.Column("from_name", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
    )
    op.create_index("ix_smtp_settings_updated_by", "smtp_settings", ["updated_by"], unique=False)

    op.create_table(
        "llm_settings",
        sa.Column("warehouse_id", sa.String(length=36), primary_key=True),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default="gemini"),
        sa.Column("api_key_encrypted", sa.String(length=4096), nullable=True),
        sa.Column("auto_tags_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("auto_alias_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_by", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
    )
    op.create_index("ix_llm_settings_updated_by", "llm_settings", ["updated_by"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_llm_settings_updated_by", table_name="llm_settings")
    op.drop_table("llm_settings")

    op.drop_index("ix_smtp_settings_updated_by", table_name="smtp_settings")
    op.drop_table("smtp_settings")
