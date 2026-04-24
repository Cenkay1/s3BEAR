from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class BucketInfo(BaseModel):
    name: str
    creation_date: Optional[datetime] = None
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
