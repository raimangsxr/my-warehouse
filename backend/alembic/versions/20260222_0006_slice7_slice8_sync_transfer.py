"""slice7 slice8 sync transfer

Revision ID: 20260222_0006
Revises: 20260222_0005
Create Date: 2026-02-22 21:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260222_0006"
down_revision = "20260222_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "change_log",
        sa.Column("seq", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("warehouse_id", sa.String(length=36), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("entity_version", sa.Integer(), nullable=True),
        sa.Column("payload_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
    )
    op.create_index("ix_change_log_warehouse_id", "change_log", ["warehouse_id"], unique=False)
    op.create_index("ix_change_log_entity_type", "change_log", ["entity_type"], unique=False)
    op.create_index("ix_change_log_entity_id", "change_log", ["entity_id"], unique=False)
    op.create_index("ix_change_log_warehouse_seq", "change_log", ["warehouse_id", "seq"], unique=False)

    op.create_table(
        "processed_commands",
        sa.Column("command_id", sa.String(length=64), primary_key=True),
        sa.Column("warehouse_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("device_id", sa.String(length=128), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("result_hash", sa.String(length=128), nullable=True),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_processed_commands_warehouse_id", "processed_commands", ["warehouse_id"], unique=False)
    op.create_index("ix_processed_commands_user_id", "processed_commands", ["user_id"], unique=False)

    op.create_table(
        "sync_conflicts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("warehouse_id", sa.String(length=36), nullable=False),
        sa.Column("command_id", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.String(length=36), nullable=False),
        sa.Column("base_version", sa.Integer(), nullable=True),
        sa.Column("server_version", sa.Integer(), nullable=True),
        sa.Column("client_payload_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="open"),
        sa.Column("created_by", sa.String(length=36), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["resolved_by"], ["users.id"]),
        sa.UniqueConstraint("command_id", name="uq_sync_conflicts_command_id"),
    )
    op.create_index("ix_sync_conflicts_warehouse_id", "sync_conflicts", ["warehouse_id"], unique=False)
    op.create_index("ix_sync_conflicts_command_id", "sync_conflicts", ["command_id"], unique=False)
    op.create_index("ix_sync_conflicts_entity_type", "sync_conflicts", ["entity_type"], unique=False)
    op.create_index("ix_sync_conflicts_entity_id", "sync_conflicts", ["entity_id"], unique=False)
    op.create_index("ix_sync_conflicts_status", "sync_conflicts", ["status"], unique=False)
    op.create_index("ix_sync_conflicts_created_by", "sync_conflicts", ["created_by"], unique=False)
    op.create_index("ix_sync_conflicts_resolved_by", "sync_conflicts", ["resolved_by"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_sync_conflicts_resolved_by", table_name="sync_conflicts")
    op.drop_index("ix_sync_conflicts_created_by", table_name="sync_conflicts")
    op.drop_index("ix_sync_conflicts_status", table_name="sync_conflicts")
    op.drop_index("ix_sync_conflicts_entity_id", table_name="sync_conflicts")
    op.drop_index("ix_sync_conflicts_entity_type", table_name="sync_conflicts")
    op.drop_index("ix_sync_conflicts_command_id", table_name="sync_conflicts")
    op.drop_index("ix_sync_conflicts_warehouse_id", table_name="sync_conflicts")
    op.drop_table("sync_conflicts")

    op.drop_index("ix_processed_commands_user_id", table_name="processed_commands")
    op.drop_index("ix_processed_commands_warehouse_id", table_name="processed_commands")
    op.drop_table("processed_commands")

    op.drop_index("ix_change_log_warehouse_seq", table_name="change_log")
    op.drop_index("ix_change_log_entity_id", table_name="change_log")
    op.drop_index("ix_change_log_entity_type", table_name="change_log")
    op.drop_index("ix_change_log_warehouse_id", table_name="change_log")
    op.drop_table("change_log")
