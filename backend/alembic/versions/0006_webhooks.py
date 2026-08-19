"""Add webhook_endpoints and webhook_deliveries tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-19

"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "webhook_endpoints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("secret", sa.String(128), nullable=False),
        sa.Column("events", postgresql.JSON, nullable=False),
        sa.Column("enabled", sa.Boolean, server_default=sa.true(), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "webhook_deliveries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("endpoint_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("webhook_endpoints.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event", sa.String(50), nullable=False),
        sa.Column("payload", postgresql.JSON, nullable=False),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("attempts", sa.Integer, server_default="0", nullable=False),
        sa.Column("last_status_code", sa.Integer, nullable=True),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_webhook_deliveries_endpoint_id", "webhook_deliveries", ["endpoint_id"])
    op.create_index("ix_webhook_deliveries_status", "webhook_deliveries", ["status"])
    op.create_index("ix_webhook_deliveries_created_at", "webhook_deliveries", ["created_at"])


def downgrade() -> None:
    op.drop_table("webhook_deliveries")
    op.drop_table("webhook_endpoints")
