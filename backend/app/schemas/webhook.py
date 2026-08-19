import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


class WebhookCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    url: str = Field(min_length=1)
    events: list[str] = Field(min_length=1)  # action names, or ["*"] for all
    secret: str | None = None  # auto-generated if omitted

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return v


class WebhookUpdateRequest(BaseModel):
    name: str | None = None
    url: str | None = None
    events: list[str] | None = None
    enabled: bool | None = None

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str | None) -> str | None:
        if v is not None and not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return v


class WebhookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    url: str
    events: list[str]
    enabled: bool
    created_at: datetime


class WebhookCreateResponse(WebhookOut):
    secret: str  # shown only once


class WebhookDeliveryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event: str
    status: str
    attempts: int
    last_status_code: int | None
    last_error: str | None
    created_at: datetime
    next_retry_at: datetime | None
    delivered_at: datetime | None
