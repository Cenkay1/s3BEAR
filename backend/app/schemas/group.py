import uuid
from pydantic import BaseModel


class BucketPermissionBase(BaseModel):
    bucket_pattern: str
    can_list: bool = False
    can_read: bool = False
    can_write: bool = False
    can_delete: bool = False


class BucketPermissionCreate(BucketPermissionBase):
    pass


class BucketPermissionRead(BucketPermissionBase):
    id: uuid.UUID
    group_id: uuid.UUID

    model_config = {"from_attributes": True}


class GroupBase(BaseModel):
    name: str
    description: str = ""


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class GroupRead(GroupBase):
    id: uuid.UUID
    permissions: list[BucketPermissionRead] = []

    model_config = {"from_attributes": True}


class AssignUsersRequest(BaseModel):
    user_ids: list[uuid.UUID]
