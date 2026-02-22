"""slice5 invites and activity

Revision ID: 20260222_0004
Revises: 20260222_0003
Create Date: 2026-02-22 13:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260222_0004"
down_revision = "20260222_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "warehouse_invites",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("warehouse_id", sa.String(length=36), nullable=False),
        sa.Column("invited_by", sa.String(length=36), nullable=False),
        sa.Column("invitee_email", sa.String(length=255), nullable=True),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"]),
    )
    op.create_index("ix_warehouse_invites_warehouse_id", "warehouse_invites", ["warehouse_id"], unique=False)
    op.create_index("ix_warehouse_invites_invited_by", "warehouse_invites", ["invited_by"], unique=False)
    op.create_index("ix_warehouse_invites_invitee_email", "warehouse_invites", ["invitee_email"], unique=False)
    op.create_index("ix_warehouse_invites_token_hash", "warehouse_invites", ["token_hash"], unique=True)

    op.create_table(
        "activity_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("warehouse_id", sa.String(length=36), nullable=False),
        sa.Column("actor_user_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=True),
        sa.Column("entity_id", sa.String(length=36), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
    )
    op.create_index("ix_activity_events_warehouse_id", "activity_events", ["warehouse_id"], unique=False)
    op.create_index("ix_activity_events_actor_user_id", "activity_events", ["actor_user_id"], unique=False)
    op.create_index("ix_activity_events_event_type", "activity_events", ["event_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_activity_events_event_type", table_name="activity_events")
    op.drop_index("ix_activity_events_actor_user_id", table_name="activity_events")
    op.drop_index("ix_activity_events_warehouse_id", table_name="activity_events")
    op.drop_table("activity_events")

    op.drop_index("ix_warehouse_invites_token_hash", table_name="warehouse_invites")
    op.drop_index("ix_warehouse_invites_invitee_email", table_name="warehouse_invites")
    op.drop_index("ix_warehouse_invites_invited_by", table_name="warehouse_invites")
    op.drop_index("ix_warehouse_invites_warehouse_id", table_name="warehouse_invites")
    op.drop_table("warehouse_invites")
