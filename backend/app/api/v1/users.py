import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel

from app.api.deps import get_db, require_admin
from app.core.security import get_password_hash
from app.models.group import Group
from app.models.settings import AppSetting
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.auth import search_entra_users
from app.services.audit import log_audit, USER_CREATE, USER_DELETE

router = APIRouter(prefix="/users", tags=["users"])

MSG_USER_NOT_FOUND = "User not found"


# ── Entra (Azure AD) user search & import ────────────────────────────────────
# These must be defined BEFORE /{user_id} routes to avoid path conflicts.

async def _get_azure_creds(db: AsyncSession) -> dict:
    """Get Azure AD credentials from DB settings, falling back to env."""
    from app.core.config import settings as env_settings

    keys = ("azure_tenant_id", "azure_client_id", "azure_client_secret")
    result = await db.execute(select(AppSetting).where(AppSetting.key.in_(keys)))
    rows = {r.key: r.value for r in result.scalars().all()}
    return {
        "tenant_id": rows.get("azure_tenant_id") or env_settings.AZURE_TENANT_ID,
        "client_id": rows.get("azure_client_id") or env_settings.AZURE_CLIENT_ID,
        "client_secret": rows.get("azure_client_secret") or env_settings.AZURE_CLIENT_SECRET,
    }


@router.get("/entra/search", responses={400: {"description": "Azure AD not configured"}, 502: {"description": "Azure AD error"}})
async def search_entra(
    q: Annotated[str, Query(min_length=2, description="Search query")],
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    creds = await _get_azure_creds(db)
    if not creds["tenant_id"] or not creds["client_id"] or not creds["client_secret"]:
        raise HTTPException(status_code=400, detail="Azure AD is not configured")
    try:
        users = await search_entra_users(q, **creds)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return users


class EntraImportItem(BaseModel):
    id: str = ""
    displayName: str = ""
    mail: str | None = None
    userPrincipalName: str = ""


class EntraImportRequest(BaseModel):
    users: list[EntraImportItem]
    group_ids: list[str] = []


@router.post("/entra/import", response_model=list[UserRead], status_code=201)
async def import_entra_users(
    body: EntraImportRequest,
    request: Request,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Load groups if specified
    groups = []
    if body.group_ids:
        group_uuids = [uuid.UUID(gid) for gid in body.group_ids]
        result = await db.execute(select(Group).where(Group.id.in_(group_uuids)))
        groups = list(result.scalars().all())

    created = []
    for item in body.users:
        email = item.mail or item.userPrincipalName
        if not email:
            continue

        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            continue  # skip duplicates

        user = User(
            email=email,
            display_name=item.displayName,
            azure_oid=item.id,
            is_active=True,
            is_admin=False,
        )
        for g in groups:
            user.groups.append(g)
        db.add(user)
        await db.flush()
        await db.refresh(user)
        await log_audit(db, _, USER_CREATE, details={"imported_email": email, "source": "entra"},
                        ip_address=request.client.host if request.client else None)
        created.append(user)

    return created


# ── Standard user CRUD ───────────────────────────────────────────────────────

@router.get("", response_model=list[UserRead])
async def list_users(
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).order_by(User.email))
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserRead, responses={404: {"description": "User not found"}})
async def get_user(
    user_id: uuid.UUID,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=MSG_USER_NOT_FOUND)
    return user


@router.post("", response_model=UserRead, status_code=201, responses={409: {"description": "Email already exists"}})
async def create_user(
    body: UserCreate,
    request: Request,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists")
    data = body.model_dump(exclude={"password", "group_ids"})
    user = User(**data)
    if body.password:
        user.password_hash = get_password_hash(body.password)
    if body.group_ids:
        group_uuids = [uuid.UUID(gid) for gid in body.group_ids]
        result = await db.execute(select(Group).where(Group.id.in_(group_uuids)))
        for g in result.scalars().all():
            user.groups.append(g)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    await log_audit(db, _, USER_CREATE, details={"created_email": body.email},
                    ip_address=request.client.host if request.client else None)
    return user


@router.patch("/{user_id}", response_model=UserRead, responses={404: {"description": "User not found"}})
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=MSG_USER_NOT_FOUND)
    updates = body.model_dump(exclude_unset=True, exclude={"password"})
    for field, value in updates.items():
        setattr(user, field, value)
    if body.password is not None:
        user.password_hash = get_password_hash(body.password)
    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204, responses={404: {"description": "User not found"}})
async def delete_user(
    user_id: uuid.UUID,
    request: Request,
    _: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=MSG_USER_NOT_FOUND)
    await log_audit(db, _, USER_DELETE, details={"deleted_email": user.email, "deleted_user_id": str(user.id)},
                    ip_address=request.client.host if request.client else None)
    await db.delete(user)
