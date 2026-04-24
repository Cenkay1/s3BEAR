import secrets
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.models.user import User
from app.models.settings import AppSetting
from app.schemas.auth import LoginUrlResponse, RefreshRequest, TokenResponse
from app.schemas.settings import AuthConfig
from app.schemas.user import UserRead
from app.services.auth import exchange_code_for_token, get_auth_url, get_user_info_from_token

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


async def _setting(db: AsyncSession, key: str, default: str = "") -> str:
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    return row.value if row else default


async def _get_azure_config(db: AsyncSession) -> dict:
    """Load Azure AD config from DB, fall back to env vars."""
    return {
        "tenant_id": (await _setting(db, "azure_tenant_id") or settings.AZURE_TENANT_ID).strip(),
        "client_id": (await _setting(db, "azure_client_id") or settings.AZURE_CLIENT_ID).strip(),
        "client_secret": (await _setting(db, "azure_client_secret") or settings.AZURE_CLIENT_SECRET).strip(),
        "redirect_uri": (await _setting(db, "azure_redirect_uri") or settings.AZURE_REDIRECT_URI).strip(),
    }


@router.get("/config", response_model=AuthConfig)
async def get_auth_config(db: Annotated[AsyncSession, Depends(get_db)]):
    return AuthConfig(
        enable_local_auth=(await _setting(db, "enable_local_auth", "true")) == "true",
        enable_azure_ad=(await _setting(db, "enable_azure_ad", "true")) == "true",
    )


@router.post("/token", response_model=TokenResponse, responses={401: {"description": "Invalid credentials"}, 403: {"description": "Local auth disabled"}})
@limiter.limit("5/minute")
async def local_login(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    username: Annotated[str, Form()],
    password: Annotated[str, Form()],
):
    if (await _setting(db, "enable_local_auth", "true")) != "true":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Local authentication is disabled")

    result = await db.execute(select(User).where(User.email == username))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No local password set for this account")
    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.get("/login", response_model=LoginUrlResponse)
async def login(db: Annotated[AsyncSession, Depends(get_db)]):
    if (await _setting(db, "enable_azure_ad", "true")) != "true":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Azure AD authentication is disabled")
    az = await _get_azure_config(db)
    if not az["tenant_id"] or not az["client_id"]:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Azure AD is not configured")
    state = secrets.token_urlsafe(32)
    auth_url = get_auth_url(state=state, **az)
    return LoginUrlResponse(auth_url=auth_url)


@router.post("/callback", response_model=TokenResponse, responses={400: {"description": "Invalid code or user info"}, 403: {"description": "Azure AD disabled or user not approved"}, 503: {"description": "Azure AD not configured"}})
@limiter.limit("10/minute")
async def callback(
    request: Request,
    code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if (await _setting(db, "enable_azure_ad", "true")) != "true":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Azure AD authentication is disabled")

    az = await _get_azure_config(db)
    if not az["tenant_id"] or not az["client_id"]:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Azure AD is not configured")

    try:
        token_result = exchange_code_for_token(code=code, **az)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    claims = token_result.get("id_token_claims", {})
    user_info = get_user_info_from_token(claims)

    if not user_info.get("azure_oid") or not user_info.get("email"):
        raise HTTPException(status_code=400, detail="Incomplete user info from Azure")

    result = await db.execute(select(User).where(User.azure_oid == user_info["azure_oid"]))
    user = result.scalar_one_or_none()

    if user is None:
        auto_create = (await _setting(db, "auto_create_users", "false")) == "true"
        if not auto_create:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User not approved. Contact an administrator to get access.",
            )
        user = User(
            email=user_info["email"],
            display_name=user_info["display_name"],
            azure_oid=user_info["azure_oid"],
        )
        db.add(user)
        await db.flush()

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenResponse, responses={401: {"description": "Invalid or expired refresh token"}})
@limiter.limit("10/minute")
async def refresh(
    request: Request,
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from jose import JWTError

    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.get("/me", response_model=UserRead)
async def me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user
