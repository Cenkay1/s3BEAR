import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    display_name: str = ""
    is_active: bool = True
    is_admin: bool = False


class UserCreate(UserBase):
    password: str | None = None
    group_ids: list[str] = []


class UserUpdate(BaseModel):
    display_name: str | None = None
    is_active: bool | None = None
    is_admin: bool | None = None
    password: str | None = None


class GroupRef(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class UserRead(UserBase):
    id: uuid.UUID
    azure_oid: str | None = None
    created_at: datetime
    groups: list[GroupRef] = []

    model_config = {"from_attributes": True}
