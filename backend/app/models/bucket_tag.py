from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BucketTag(Base):
    """A key/value tag attached to a managed bucket.

    Tags live in s3BEAR's own database (not native S3 bucket tagging) so they
    work uniformly across every provider type and can power fast key/value
    autocomplete and filtering. A bucket has at most one value per key.
    """

    __tablename__ = "bucket_tags"

    bucket_name: Mapped[str] = mapped_column(String(63), primary_key=True)
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[str] = mapped_column(String(256), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
