import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, model_validator


class CleanupPolicyBase(BaseModel):
    name: str
    target_type: str = "pattern"  # "pattern" | "tag"
    bucket_patterns: list[str] = []
    tag_key: Optional[str] = None
    tag_value: Optional[str] = None
    prefix_filter: Optional[str] = None
    older_than_days: Optional[int] = None
    cron_expression: str = "0 2 * * *"
    is_active: bool = True

    @model_validator(mode="after")
    def _check_targeting(self):
        if self.target_type not in ("pattern", "tag"):
            raise ValueError("target_type must be 'pattern' or 'tag'")
        if self.target_type == "pattern":
            if not self.bucket_patterns:
                raise ValueError("At least one bucket pattern is required")
            # Clear the tag fields so a pattern policy can't also carry a tag.
            self.tag_key = None
            self.tag_value = None
        else:  # tag
            if not self.tag_key:
                raise ValueError("A tag key is required for tag-based targeting")
            self.bucket_patterns = []
        return self


class CleanupPolicyCreate(CleanupPolicyBase):
    pass


class CleanupPolicyUpdate(BaseModel):
    name: str | None = None
    target_type: str | None = None
    bucket_patterns: list[str] | None = None
    tag_key: str | None = None
    tag_value: str | None = None
    prefix_filter: str | None = None
    older_than_days: int | None = None
    cron_expression: str | None = None
    is_active: bool | None = None


class CleanupPolicyRead(CleanupPolicyBase):
    id: uuid.UUID
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None
    last_run_deleted_count: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RunResult(BaseModel):
    policy_id: uuid.UUID
    deleted_count: int
    status: str
    message: str
