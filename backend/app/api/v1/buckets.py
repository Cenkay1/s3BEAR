import re
import uuid
from fnmatch import fnmatch
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_admin
from app.models.user import User
from app.models.settings import AppSetting
from app.models.provider import StorageProvider, ManagedBucket
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
    provider_id: str | None = None  # which storage provider serves this bucket

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
                    provider_id=bucket.get("provider_id"),
                    provider_name=bucket.get("provider_name"),
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
    # Resolve the target provider: explicit choice, else the default provider.
    provider: StorageProvider | None = None
    if body.provider_id:
        try:
            pid = uuid.UUID(body.provider_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid provider_id")
        provider = (await db.execute(select(StorageProvider).where(StorageProvider.id == pid))).scalar_one_or_none()
        if provider is None:
            raise HTTPException(status_code=404, detail="Provider not found")
    else:
        provider = (await db.execute(select(StorageProvider).where(StorageProvider.is_default == True))).scalar_one_or_none()  # noqa: E712

    # Bucket names are globally unique across s3BEAR so routing stays unambiguous.
    already = (await db.execute(select(ManagedBucket).where(ManagedBucket.name == body.name))).scalar_one_or_none()
    if already:
        raise HTTPException(status_code=409, detail=f"Bucket '{body.name}' already exists")

    try:
        await s3_service.create_bucket(body.name, provider_id=str(provider.id) if provider else None)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    if provider is not None:
        db.add(ManagedBucket(name=body.name, provider_id=provider.id))

    if body.quota_gb is not None:
        key = f"bucket_quota_gb:{body.name}"
        existing = await db.execute(select(AppSetting).where(AppSetting.key == key))
        row = existing.scalar_one_or_none()
        if row:
            row.value = str(body.quota_gb)
        else:
            db.add(AppSetting(key=key, value=str(body.quota_gb)))

    await log_audit(db, admin, CREATE_BUCKET, bucket=body.name,
                    details={"quota_gb": body.quota_gb, "provider": provider.name if provider else None},
                    ip_address=request.client.host if request.client else None)
    await db.flush()
    if provider is not None:
        s3_service.register_bucket(body.name, str(provider.id))
    return {"name": body.name, "quota_gb": body.quota_gb,
            "provider_id": str(provider.id) if provider else None,
            "provider_name": provider.name if provider else None}


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

    mb = (await db.execute(select(ManagedBucket).where(ManagedBucket.name == bucket_name))).scalar_one_or_none()
    if mb:
        await db.delete(mb)
    s3_service.unregister_bucket(bucket_name)

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
