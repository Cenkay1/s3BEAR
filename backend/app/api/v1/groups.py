import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.group import BucketPermission, Group
from app.models.user import User, UserGroup
from app.schemas.group import (
    AssignUsersRequest,
    BucketPermissionCreate,
    BucketPermissionRead,
    GroupCreate,
    GroupRead,
    GroupUpdate,
)

router = APIRouter(prefix="/groups", tags=["groups"])

MSG_GROUP_NOT_FOUND = "Group not found"


@router.get("", response_model=list[GroupRead])
async def list_groups(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Group).order_by(Group.name))
    return result.scalars().all()


@router.get("/{group_id}", response_model=GroupRead, responses={404: {"description": "Group not found"}})
async def get_group(
    group_id: uuid.UUID,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail=MSG_GROUP_NOT_FOUND)
    return group


@router.post("", response_model=GroupRead, status_code=201, responses={409: {"description": "Group name already exists"}})
async def create_group(
    body: GroupCreate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await db.execute(select(Group).where(Group.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Group name already exists")
    group = Group(**body.model_dump())
    db.add(group)
    await db.flush()
    await db.refresh(group)
    return group


@router.patch("/{group_id}", response_model=GroupRead, responses={404: {"description": "Group not found"}})
async def update_group(
    group_id: uuid.UUID,
    body: GroupUpdate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail=MSG_GROUP_NOT_FOUND)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    await db.flush()
    await db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=204, responses={404: {"description": "Group not found"}})
async def delete_group(
    group_id: uuid.UUID,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail=MSG_GROUP_NOT_FOUND)
    await db.delete(group)


@router.post("/{group_id}/users", status_code=204, responses={404: {"description": "Group not found"}})
async def assign_users(
    group_id: uuid.UUID,
    body: AssignUsersRequest,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=MSG_GROUP_NOT_FOUND)

    # Remove existing memberships
    await db.execute(delete(UserGroup).where(UserGroup.group_id == group_id))

    # Add new memberships
    for user_id in body.user_ids:
        db.add(UserGroup(user_id=user_id, group_id=group_id))


@router.get("/{group_id}/permissions", response_model=list[BucketPermissionRead])
async def list_permissions(
    group_id: uuid.UUID,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(BucketPermission).where(BucketPermission.group_id == group_id)
    )
    return result.scalars().all()


@router.post("/{group_id}/permissions", response_model=BucketPermissionRead, status_code=201, responses={404: {"description": "Group not found"}})
async def add_permission(
    group_id: uuid.UUID,
    body: BucketPermissionCreate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=MSG_GROUP_NOT_FOUND)
    perm = BucketPermission(group_id=group_id, **body.model_dump())
    db.add(perm)
    await db.flush()
    await db.refresh(perm)
    return perm


@router.delete("/{group_id}/permissions/{perm_id}", status_code=204, responses={404: {"description": "Permission not found"}})
async def delete_permission(
    group_id: uuid.UUID,
    perm_id: uuid.UUID,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(BucketPermission).where(
            BucketPermission.id == perm_id,
            BucketPermission.group_id == group_id,
        )
    )
    perm = result.scalar_one_or_none()
    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found")
    await db.delete(perm)
