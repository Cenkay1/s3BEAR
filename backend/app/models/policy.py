import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from app.core.database import Base


class CleanupPolicy(Base):
    __tablename__ = "cleanup_policies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Targeting mode: "pattern" (bucket_patterns) or "tag" (tag_key/tag_value). Exactly one.
    target_type: Mapped[str] = mapped_column(String(20), nullable=False, default="pattern")
    bucket_patterns: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    tag_key: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    tag_value: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    prefix_filter: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    older_than_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False, default="0 2 * * *")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_run_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_run_deleted_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
