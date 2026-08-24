import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, String, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class StorageProvider(Base):
    """An S3-compatible storage backend (AWS S3, MinIO, Ceph, Wasabi, …).

    Multiple providers can be registered; each managed bucket is bound to exactly
    one provider, and all operations on that bucket are routed to it.
    """

    __tablename__ = "storage_providers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False, default="aws")  # aws|minio|ceph|wasabi|custom
    access_key_id: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    secret_access_key: Mapped[str] = mapped_column(Text, nullable=False, default="")
    region: Mapped[str] = mapped_column(String(100), nullable=False, default="us-east-1")
    endpoint_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    presigned_base: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    use_ssl: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    buckets: Mapped[list["ManagedBucket"]] = relationship(
        "ManagedBucket", back_populates="provider", cascade="all, delete-orphan", lazy="selectin"
    )


class ManagedBucket(Base):
    """Maps a bucket name to the storage provider that serves it.

    Bucket names are treated as globally unique across s3BEAR so a name alone is
    enough to route an object operation to the correct provider.
    """

    __tablename__ = "managed_buckets"

    name: Mapped[str] = mapped_column(String(63), primary_key=True)
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_providers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    provider: Mapped["StorageProvider"] = relationship("StorageProvider", back_populates="buckets")
