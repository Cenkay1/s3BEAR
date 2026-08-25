"""Add bucket_tags table

Stores key/value tags for managed buckets in s3BEAR's own database, powering
tag-based filtering and key/value autocomplete in the console.

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-24

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bucket_tags",
        sa.Column("bucket_name", sa.String(63), primary_key=True),
        sa.Column("key", sa.String(128), primary_key=True),
        sa.Column("value", sa.String(256), server_default="", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_bucket_tags_bucket_name", "bucket_tags", ["bucket_name"])
    op.create_index("ix_bucket_tags_key", "bucket_tags", ["key"])


def downgrade() -> None:
    op.drop_index("ix_bucket_tags_key", table_name="bucket_tags")
    op.drop_index("ix_bucket_tags_bucket_name", table_name="bucket_tags")
    op.drop_table("bucket_tags")
