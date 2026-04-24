import re
from fnmatch import fnmatch
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_admin
from app.models.user import User
from app.models.settings import AppSetting
from app.schemas.s3 import BucketInfo, BrowseResult, S3Object
from app.services import s3 as s3_service
from app.services.audit import log_audit, CREATE_BUCKET, DELETE_BUCKET

router = APIRouter(prefix="/buckets", tags=["buckets"])


def _resolve_permissions(user: User, bucket_name: str) -> dict:
    if user.is_admin:
        return {"can_list": True, "can_read": True, "can_write": True, "can_delete": True}

    perms = {"can_list": False, "can_read": False, "can_write": False, "can_delete": False}
    for group in user.groups:
        for perm in group.permissions:
            if fnmatch(bucket_name, perm.bucket_pattern):
                perms["can_list"] = perms["can_list"] or perm.can_list
                perms["can_read"] = perms["can_read"] or perm.can_read
                perms["can_write"] = perms["can_write"] or perm.can_write
                perms["can_delete"] = perms["can_delete"] or perm.can_delete
    return perms


_BUCKET_NAME_RE = re.compile(r'^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$')


class CreateBucketRequest(BaseModel):
    name: str
    quota_gb: float | None = None

    @field_validator("name")
    @classmethod
    def validate_bucket_name(cls, v: str) -> str:
        if not _BUCKET_NAME_RE.match(v):
            raise ValueError(
                "Invalid bucket name. Must be 3-63 characters, lowercase letters, numbers, dots and hyphens only."
            )
        if ".." in v:
            raise ValueError("Bucket name must not contain consecutive dots")
        return v


@router.get("", response_model=list[BucketInfo])
async def list_buckets(
    current_user: Annotated[User, Depends(get_current_user)],
):
    all_buckets = await s3_service.list_buckets()
    result = []
    for bucket in all_buckets:
        perms = _resolve_permissions(current_user, bucket["name"])
        if any(perms.values()):  # only include if user has at least one permission
            result.append(
                BucketInfo(
                    name=bucket["name"],
                    creation_date=bucket.get("creation_date"),
                    **perms,
                )
            )
    return result


@router.post("", status_code=201, responses={409: {"description": "Bucket already exists"}})
async def create_bucket(
    body: CreateBucketRequest,
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        await s3_service.create_bucket(body.name)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    if body.quota_gb is not None:
        key = f"bucket_quota_gb:{body.name}"
        existing = await db.execute(select(AppSetting).where(AppSetting.key == key))
        row = existing.scalar_one_or_none()
        if row:
            row.value = str(body.quota_gb)
        else:
            db.add(AppSetting(key=key, value=str(body.quota_gb)))

    await log_audit(db, admin, CREATE_BUCKET, bucket=body.name,
                    details={"quota_gb": body.quota_gb} if body.quota_gb else None,
                    ip_address=request.client.host if request.client else None)
    return {"name": body.name, "quota_gb": body.quota_gb}


@router.delete("/{bucket_name}", status_code=200, responses={404: {"description": "Bucket not found"}, 409: {"description": "Bucket not empty"}})
async def delete_bucket(
    bucket_name: str,
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        await s3_service.delete_bucket(bucket_name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    await log_audit(db, admin, DELETE_BUCKET, bucket=bucket_name,
                    ip_address=request.client.host if request.client else None)
    return {"deleted": bucket_name}


@router.get("/{bucket_name}/browse", response_model=BrowseResult, responses={403: {"description": "No list permission"}})
async def browse_bucket(
    bucket_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    prefix: Annotated[str, Query()] = "",
):
    perms = _resolve_permissions(current_user, bucket_name)
    if not perms["can_list"]:
        raise HTTPException(status_code=403, detail="No list permission for this bucket")

    data = await s3_service.list_objects(bucket=bucket_name, prefix=prefix)
    objects = [
        S3Object(
            key=obj["key"],
            size=obj["size"],
            last_modified=obj["last_modified"],
            etag=obj["etag"],
        )
        for obj in data["objects"]
    ]
    return BrowseResult(
        prefix=prefix,
        objects=objects,
        common_prefixes=data["common_prefixes"],
    )
