import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CleanupPolicyBase(BaseModel):
    name: str
    bucket_patterns: list[str]
    prefix_filter: Optional[str] = None
    older_than_days: Optional[int] = None
    cron_expression: str = "0 2 * * *"
    is_active: bool = True


class CleanupPolicyCreate(CleanupPolicyBase):
    pass


class CleanupPolicyUpdate(BaseModel):
    name: str | None = None
    bucket_patterns: list[str] | None = None
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
