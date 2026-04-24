import uuid
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise credentials_exc
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exc
    return user


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


_ACTION_MAP = {
    "list": "can_list",
    "read": "can_read",
    "write": "can_write",
    "delete": "can_delete",
}


def _is_safe_pattern(pattern: str) -> bool:
    """Reject patterns with character class brackets to prevent fnmatch abuse."""
    return "[" not in pattern and "]" not in pattern


def _has_permission(user: User, bucket_name: str, attr: str) -> bool:
    """Check if any of the user's group permissions grant the given action on the bucket."""
    from fnmatch import fnmatch

    for group in user.groups:
        for perm in group.permissions:
            if _is_safe_pattern(perm.bucket_pattern) and fnmatch(bucket_name, perm.bucket_pattern) and getattr(perm, attr):
                return True
    return False


def require_bucket_permission(action: str):
    """Returns a dependency that checks if the current user can perform `action` on a bucket."""
    attr = _ACTION_MAP.get(action)
    if not attr:
        raise ValueError(f"Unknown action: {action}")

    async def checker(
        bucket_name: str,
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if not current_user.is_admin and not _has_permission(current_user, bucket_name, attr):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No '{action}' permission for bucket '{bucket_name}'",
            )
        return current_user

    return checker
