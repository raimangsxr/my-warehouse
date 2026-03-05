"""add intake batches and drafts

Revision ID: 20260305_0009
Revises: 20260304_0008
Create Date: 2026-03-05 16:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260305_0009"
down_revision = "20260304_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "intake_batches",
        sa.Column("warehouse_id", sa.String(length=36), nullable=False),
        sa.Column("target_box_id", sa.String(length=36), nullable=False),
        sa.Column("created_by", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="drafting"),
        sa.Column("total_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("committed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["target_box_id"], ["boxes.id"]),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_intake_batches_warehouse_id", "intake_batches", ["warehouse_id"], unique=False)
    op.create_index("ix_intake_batches_target_box_id", "intake_batches", ["target_box_id"], unique=False)
    op.create_index("ix_intake_batches_created_by", "intake_batches", ["created_by"], unique=False)
    op.create_index("ix_intake_batches_status", "intake_batches", ["status"], unique=False)

    op.create_table(
        "intake_drafts",
        sa.Column("warehouse_id", sa.String(length=36), nullable=False),
        sa.Column("batch_id", sa.String(length=36), nullable=False),
        sa.Column("photo_url", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="uploaded"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("name", sa.String(length=160), nullable=True),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("aliases", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("warnings", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("llm_used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("error_message", sa.String(length=500), nullable=True),
        sa.Column("processing_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_item_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["intake_batches.id"]),
        sa.ForeignKeyConstraint(["created_item_id"], ["items.id"]),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_intake_drafts_warehouse_id", "intake_drafts", ["warehouse_id"], unique=False)
    op.create_index("ix_intake_drafts_batch_id", "intake_drafts", ["batch_id"], unique=False)
    op.create_index("ix_intake_drafts_status", "intake_drafts", ["status"], unique=False)
    op.create_index("ix_intake_drafts_created_item_id", "intake_drafts", ["created_item_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_intake_drafts_created_item_id", table_name="intake_drafts")
    op.drop_index("ix_intake_drafts_status", table_name="intake_drafts")
    op.drop_index("ix_intake_drafts_batch_id", table_name="intake_drafts")
    op.drop_index("ix_intake_drafts_warehouse_id", table_name="intake_drafts")
    op.drop_table("intake_drafts")

    op.drop_index("ix_intake_batches_status", table_name="intake_batches")
    op.drop_index("ix_intake_batches_created_by", table_name="intake_batches")
    op.drop_index("ix_intake_batches_target_box_id", table_name="intake_batches")
    op.drop_index("ix_intake_batches_warehouse_id", table_name="intake_batches")
    op.drop_table("intake_batches")
