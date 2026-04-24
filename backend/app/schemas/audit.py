import uuid
from datetime import datetime
from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None = None
    user_email: str
    action: str
    bucket: str | None = None
    object_key: str | None = None
    details: dict | None = None
    ip_address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditPage(BaseModel):
    items: list[AuditLogRead]
    total: int
    page: int
    page_size: int
