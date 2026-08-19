import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.api_token import TokenCreateRequest, TokenCreateResponse, TokenOut
from app.services import api_token as api_token_service
from app.services import share as share_service  # reuse expires_in parsing
from app.services.audit import log_audit, TOKEN_CREATE, TOKEN_REVOKE

router = APIRouter(prefix="/tokens", tags=["tokens"])


@router.post("", response_model=TokenCreateResponse, responses={400: {"description": "Invalid expiry"}})
async def create_token(
    body: TokenCreateRequest,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a personal access token. The raw token is returned only once."""
    try:
        expires_at = share_service.parse_expires_in(body.expires_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    row, raw = await api_token_service.create_token(db, current_user, body.name, expires_at)
    await log_audit(db, current_user, TOKEN_CREATE,
                    details={"token_id": str(row.id), "name": row.name,
                             "expires_at": expires_at.isoformat() if expires_at else None},
                    ip_address=request.client.host if request.client else None)
    return TokenCreateResponse(
        id=row.id,
        name=row.name,
        token=raw,
        token_prefix=row.token_prefix,
        expires_at=expires_at,
    )


@router.get("", response_model=list[TokenOut])
async def list_tokens(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List the caller's personal access tokens."""
    return await api_token_service.list_tokens(db, current_user)


@router.delete("/{token_id}", responses={404: {"description": "Token not found"}})
async def revoke_token(
    token_id: uuid.UUID,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Revoke a personal access token. Owner or admin only."""
    row = await api_token_service.revoke_token(db, current_user, token_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Token not found")
    await log_audit(db, current_user, TOKEN_REVOKE,
                    details={"token_id": str(row.id), "name": row.name},
                    ip_address=request.client.host if request.client else None)
    return {"revoked": str(row.id)}
