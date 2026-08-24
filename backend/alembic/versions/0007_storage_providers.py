"""Add storage_providers and managed_buckets tables (multi-provider support)

Migrates the legacy single S3 connection (stored under the s3_* app_settings
keys) into a default StorageProvider row so existing deployments keep working.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-23

"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "storage_providers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("provider_type", sa.String(50), server_default="aws", nullable=False),
        sa.Column("access_key_id", sa.String(255), server_default="", nullable=False),
        sa.Column("secret_access_key", sa.Text, server_default="", nullable=False),
        sa.Column("region", sa.String(100), server_default="us-east-1", nullable=False),
        sa.Column("endpoint_url", sa.String(500), server_default="", nullable=False),
        sa.Column("presigned_base", sa.String(500), server_default="", nullable=False),
        sa.Column("use_ssl", sa.Boolean, server_default=sa.true(), nullable=False),
        sa.Column("is_default", sa.Boolean, server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_storage_providers_name", "storage_providers", ["name"], unique=True)

    op.create_table(
        "managed_buckets",
        sa.Column("name", sa.String(63), primary_key=True),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("storage_providers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_managed_buckets_provider_id", "managed_buckets", ["provider_id"])

    # ── Migrate the legacy single S3 connection into a default provider ──────────
    conn = op.get_bind()
    rows = conn.execute(sa.text(
        "SELECT key, value FROM app_settings WHERE key LIKE 's3\\_%'"
    )).fetchall()
    s3 = {r[0]: r[1] for r in rows}
    if s3.get("s3_access_key_id"):
        conn.execute(
            sa.text(
                """
                INSERT INTO storage_providers
                    (id, name, provider_type, access_key_id, secret_access_key,
                     region, endpoint_url, presigned_base, use_ssl, is_default)
                VALUES
                    (:id, :name, :ptype, :ak, :sk, :region, :endpoint, :presigned, :ssl, true)
                """
            ),
            {
                "id": uuid.uuid4(),
                "name": "Default",
                "ptype": s3.get("s3_provider", "aws"),
                "ak": s3.get("s3_access_key_id", ""),
                "sk": s3.get("s3_secret_access_key", ""),
                "region": s3.get("s3_region", "us-east-1"),
                "endpoint": s3.get("s3_endpoint_url", ""),
                "presigned": s3.get("s3_presigned_base", ""),
                "ssl": s3.get("s3_use_ssl", "true") == "true",
            },
        )


def downgrade() -> None:
    op.drop_index("ix_managed_buckets_provider_id", table_name="managed_buckets")
    op.drop_table("managed_buckets")
    op.drop_index("ix_storage_providers_name", table_name="storage_providers")
    op.drop_table("storage_providers")
