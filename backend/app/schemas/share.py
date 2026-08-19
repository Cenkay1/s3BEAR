import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ShareCreateRequest(BaseModel):
    # "1h" / "24h" / "7d" / "30d" / integer-seconds string / "never". Empty -> 7d.
    expires_in: str = "7d"


class ShareCreateResponse(BaseModel):
    token: str
    url: str
    expires_at: datetime | None


class ShareLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bucket: str
    object_key: str
    created_by_email: str
    created_at: datetime
    expires_at: datetime | None
    revoked: bool
    access_count: int
    last_accessed_at: datetime | None
