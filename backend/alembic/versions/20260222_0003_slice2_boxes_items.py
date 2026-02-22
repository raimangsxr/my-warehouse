"""slice2 boxes items stock favorites

Revision ID: 20260222_0003
Revises: 20260222_0002
Create Date: 2026-02-22 13:20:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260222_0003"
down_revision = "20260222_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "boxes",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("warehouse_id", sa.String(length=36), nullable=False),
        sa.Column("parent_box_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("physical_location", sa.String(length=255), nullable=True),
        sa.Column("qr_token", sa.String(length=64), nullable=False),
        sa.Column("short_code", sa.String(length=16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["parent_box_id"], ["boxes.id"]),
    )
    op.create_index("ix_boxes_warehouse_id", "boxes", ["warehouse_id"], unique=False)
    op.create_index("ix_boxes_parent_box_id", "boxes", ["parent_box_id"], unique=False)
    op.create_index("ix_boxes_qr_token", "boxes", ["qr_token"], unique=True)
    op.create_index("ix_boxes_short_code", "boxes", ["short_code"], unique=False)
    op.create_index("ix_boxes_deleted_at", "boxes", ["deleted_at"], unique=False)

    op.create_table(
        "items",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("warehouse_id", sa.String(length=36), nullable=False),
        sa.Column("box_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("photo_url", sa.String(length=500), nullable=True),
        sa.Column("physical_location", sa.String(length=255), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("aliases", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["box_id"], ["boxes.id"]),
    )
    op.create_index("ix_items_warehouse_id", "items", ["warehouse_id"], unique=False)
    op.create_index("ix_items_box_id", "items", ["box_id"], unique=False)
    op.create_index("ix_items_name", "items", ["name"], unique=False)
    op.create_index("ix_items_deleted_at", "items", ["deleted_at"], unique=False)

    op.create_table(
        "item_favorites",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("item_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"]),
        sa.PrimaryKeyConstraint("user_id", "item_id"),
    )

    op.create_table(
        "stock_movements",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("warehouse_id", sa.String(length=36), nullable=False),
        sa.Column("item_id", sa.String(length=36), nullable=False),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("command_id", sa.String(length=64), nullable=False),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"]),
        sa.UniqueConstraint("item_id", "command_id", name="uq_stock_movements_item_command"),
    )
    op.create_index("ix_stock_movements_warehouse_id", "stock_movements", ["warehouse_id"], unique=False)
    op.create_index("ix_stock_movements_item_id", "stock_movements", ["item_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_stock_movements_item_id", table_name="stock_movements")
    op.drop_index("ix_stock_movements_warehouse_id", table_name="stock_movements")
    op.drop_table("stock_movements")

    op.drop_table("item_favorites")

    op.drop_index("ix_items_deleted_at", table_name="items")
    op.drop_index("ix_items_name", table_name="items")
    op.drop_index("ix_items_box_id", table_name="items")
    op.drop_index("ix_items_warehouse_id", table_name="items")
    op.drop_table("items")

    op.drop_index("ix_boxes_deleted_at", table_name="boxes")
    op.drop_index("ix_boxes_short_code", table_name="boxes")
    op.drop_index("ix_boxes_qr_token", table_name="boxes")
    op.drop_index("ix_boxes_parent_box_id", table_name="boxes")
    op.drop_index("ix_boxes_warehouse_id", table_name="boxes")
    op.drop_table("boxes")
