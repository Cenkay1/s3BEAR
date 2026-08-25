from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class BucketTag(BaseModel):
    key: str
    value: str = ""


class BucketInfo(BaseModel):
    name: str
    creation_date: Optional[datetime] = None
    provider_id: Optional[str] = None
    provider_name: Optional[str] = None
    tags: list[BucketTag] = []
    can_list: bool
    can_read: bool
    can_write: bool
    can_delete: bool


class S3Object(BaseModel):
    key: str
    size: int
    last_modified: datetime
    etag: str
    is_folder: bool = False


class BrowseResult(BaseModel):
    prefix: str
    objects: list[S3Object]
    common_prefixes: list[str]  # virtual folders


class CopyMoveRequest(BaseModel):
    source_bucket: str
    source_key: str
    dest_key: str


class DeleteRequest(BaseModel):
    keys: list[str]


class DeleteResult(BaseModel):
    deleted: list[str]
    errors: list[str]


class BulkCopyMoveRequest(BaseModel):
    source_bucket: str
    keys: list[str]
    dest_prefix: str = ""  # objects land at dest_prefix + basename(source_key)


class BulkError(BaseModel):
    key: str
    error: str


class BulkResult(BaseModel):
    succeeded: list[str]
    errors: list[BulkError]
