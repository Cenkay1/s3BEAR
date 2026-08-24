from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class StorageProviderBase(BaseModel):
    name: str
    provider_type: str = "aws"  # aws|minio|ceph|wasabi|custom
    access_key_id: str
    region: str = "us-east-1"
    endpoint_url: str = ""
    presigned_base: str = ""
    use_ssl: bool = True


class StorageProviderCreate(StorageProviderBase):
    secret_access_key: str
    is_default: bool = False


class StorageProviderUpdate(BaseModel):
    name: Optional[str] = None
    provider_type: Optional[str] = None
    access_key_id: Optional[str] = None
    secret_access_key: Optional[str] = None  # None = keep existing secret
    region: Optional[str] = None
    endpoint_url: Optional[str] = None
    presigned_base: Optional[str] = None
    use_ssl: Optional[bool] = None
    is_default: Optional[bool] = None


class StorageProviderRead(StorageProviderBase):
    id: UUID
    is_default: bool
    has_secret: bool
    bucket_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ProviderTestRequest(StorageProviderBase):
    secret_access_key: Optional[str] = None  # None = use stored secret (when id given)
    id: Optional[UUID] = None


class ProviderTestResult(BaseModel):
    ok: bool
    error: Optional[str] = None
