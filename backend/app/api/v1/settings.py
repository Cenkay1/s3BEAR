from typing import Annotated
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.core.config import settings as env_settings
from app.models.settings import AppSetting
from app.models.user import User
from app.schemas.settings import AuthConfig, AuthConfigUpdate, AzureAdConfig, AzureAdConfigUpdate
from app.services import s3 as s3_service

router = APIRouter(prefix="/settings", tags=["settings"])

_AUTH_KEYS = ("enable_local_auth", "enable_azure_ad")
_AZURE_KEYS = ("azure_tenant_id", "azure_client_id", "azure_client_secret", "azure_redirect_uri")


async def _get_rows(db: AsyncSession, keys: tuple) -> dict[str, str]:
    result = await db.execute(select(AppSetting).where(AppSetting.key.in_(keys)))
    return {r.key: r.value for r in result.scalars().all()}


async def _upsert(db: AsyncSession, key: str, value: str) -> None:
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))


async def _get_setting(db: AsyncSession, key: str, default: str = "") -> str:
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    return row.value if row else default


# ── Auth toggles ─────────────────────────────────────────────────────────────

@router.get("/auth", response_model=AuthConfig)
async def get_auth_settings(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rows = await _get_rows(db, _AUTH_KEYS)
    return AuthConfig(
        enable_local_auth=rows.get("enable_local_auth", "true") == "true",
        enable_azure_ad=rows.get("enable_azure_ad", "true") == "true",
    )


@router.put("/auth", response_model=AuthConfig)
async def update_auth_settings(
    body: AuthConfigUpdate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _upsert(db, "enable_local_auth", str(body.enable_local_auth).lower())
    await _upsert(db, "enable_azure_ad", str(body.enable_azure_ad).lower())
    await db.flush()
    rows = await _get_rows(db, _AUTH_KEYS)
    return AuthConfig(
        enable_local_auth=rows.get("enable_local_auth", "true") == "true",
        enable_azure_ad=rows.get("enable_azure_ad", "true") == "true",
    )


# ── Azure AD config ───────────────────────────────────────────────────────────

@router.get("/azure", response_model=AzureAdConfig)
async def get_azure_settings(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    rows = await _get_rows(db, _AZURE_KEYS)
    return AzureAdConfig(
        tenant_id=rows.get("azure_tenant_id") or env_settings.AZURE_TENANT_ID,
        client_id=rows.get("azure_client_id") or env_settings.AZURE_CLIENT_ID,
        redirect_uri=rows.get("azure_redirect_uri") or env_settings.AZURE_REDIRECT_URI,
        has_secret=bool(rows.get("azure_client_secret") or env_settings.AZURE_CLIENT_SECRET),
    )


@router.put("/azure", response_model=AzureAdConfig)
async def update_azure_settings(
    body: AzureAdConfigUpdate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _upsert(db, "azure_tenant_id", body.tenant_id)
    await _upsert(db, "azure_client_id", body.client_id)
    await _upsert(db, "azure_redirect_uri", body.redirect_uri)
    if body.client_secret is not None:
        await _upsert(db, "azure_client_secret", body.client_secret)
    await db.flush()

    rows = await _get_rows(db, _AZURE_KEYS)
    return AzureAdConfig(
        tenant_id=rows.get("azure_tenant_id") or env_settings.AZURE_TENANT_ID,
        client_id=rows.get("azure_client_id") or env_settings.AZURE_CLIENT_ID,
        redirect_uri=rows.get("azure_redirect_uri") or env_settings.AZURE_REDIRECT_URI,
        has_secret=bool(rows.get("azure_client_secret") or env_settings.AZURE_CLIENT_SECRET),
    )


# ── Storage stats & quotas ───────────────────────────────────────────────────

@router.get("/storage")
async def get_storage_stats(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    stats = await s3_service.get_storage_stats()

    # Load global quota
    global_quota_gb = await _get_setting(db, "storage_quota_gb", "0")
    stats["quota_bytes"] = int(float(global_quota_gb) * 1024 * 1024 * 1024) if float(global_quota_gb) > 0 else 0

    # Load per-bucket quotas
    result = await db.execute(
        select(AppSetting).where(AppSetting.key.like("bucket_quota_gb:%"))
    )
    bucket_quotas = {r.key.split(":", 1)[1]: float(r.value) for r in result.scalars().all()}

    for b in stats["buckets"]:
        quota_gb = bucket_quotas.get(b["name"], 0)
        b["quota_bytes"] = int(quota_gb * 1024 * 1024 * 1024) if quota_gb > 0 else 0

    return stats


class GlobalQuotaUpdate(BaseModel):
    quota_gb: float


@router.put("/storage/quota")
async def update_global_quota(
    body: GlobalQuotaUpdate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await _upsert(db, "storage_quota_gb", str(body.quota_gb))
    await db.flush()
    return {"quota_gb": body.quota_gb}


class BucketQuotaUpdate(BaseModel):
    quota_gb: float


@router.put("/storage/quota/{bucket_name}")
async def update_bucket_quota(
    bucket_name: str,
    body: BucketQuotaUpdate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    key = f"bucket_quota_gb:{bucket_name}"
    if body.quota_gb <= 0:
        # Remove quota
        result = await db.execute(select(AppSetting).where(AppSetting.key == key))
        row = result.scalar_one_or_none()
        if row:
            await db.delete(row)
    else:
        await _upsert(db, key, str(body.quota_gb))
    await db.flush()
    return {"bucket": bucket_name, "quota_gb": body.quota_gb}
