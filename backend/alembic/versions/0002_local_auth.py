"""Add local auth support

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-09

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))

    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
    )

    op.execute("INSERT INTO app_settings (key, value) VALUES ('enable_local_auth', 'true')")
    op.execute("INSERT INTO app_settings (key, value) VALUES ('enable_azure_ad', 'true')")


def downgrade() -> None:
    op.drop_table("app_settings")
    op.drop_column("users", "password_hash")
