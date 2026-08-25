"""Add tag-based targeting to cleanup policies

A policy targets buckets either by name pattern (existing bucket_patterns) or by
a single tag (tag_key + optional tag_value). The target_type column records which.

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-25

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cleanup_policies", sa.Column("target_type", sa.String(20), server_default="pattern", nullable=False))
    op.add_column("cleanup_policies", sa.Column("tag_key", sa.String(128), nullable=True))
    op.add_column("cleanup_policies", sa.Column("tag_value", sa.String(256), nullable=True))


def downgrade() -> None:
    op.drop_column("cleanup_policies", "tag_value")
    op.drop_column("cleanup_policies", "tag_key")
    op.drop_column("cleanup_policies", "target_type")
