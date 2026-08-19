import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class TokenCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    # "30d" / "90d" / integer-seconds string / "never" (default). Empty -> never.
    expires_in: str = "never"


class TokenCreateResponse(BaseModel):
    id: uuid.UUID
    name: str
    token: str  # shown only once
    token_prefix: str
    expires_at: datetime | None


class TokenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    token_prefix: str
    created_at: datetime
    expires_at: datetime | None
    last_used_at: datetime | None
    revoked: bool
