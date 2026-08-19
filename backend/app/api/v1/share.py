import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_bucket_permission
from app.api.v1.image_utils import parse_or_400, render_transformed
from app.models.user import User
from app.schemas.share import ShareCreateRequest, ShareCreateResponse, ShareLinkOut
from app.services import s3 as s3_service
from app.services import share as share_service
from app.services.audit import log_audit, SHARE_CREATE, SHARE_REVOKE

router = APIRouter(tags=["share"])

_GONE_DETAIL = "This share link is no longer available"


@router.post("/share/{bucket_name}/{object_key:path}", response_model=ShareCreateResponse,
             responses={403: {"description": "No read permission"}, 400: {"description": "Invalid expiry"}})
async def create_share_link(
    bucket_name: str,
    object_key: str,
    request: Request,
    current_user: Annotated[User, Depends(require_bucket_permission("read"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    body: ShareCreateRequest | None = None,
):
    """Create a tokenized, expiring public link for an object. Requires 'read'."""
    expires_in = body.expires_in if body is not None else "7d"
    try:
        expires_at = share_service.parse_expires_in(expires_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    link, raw_token = await share_service.create_share_link(
        db, current_user, bucket_name, object_key, expires_at
    )
    await log_audit(db, current_user, SHARE_CREATE, bucket=bucket_name, object_key=object_key,
                    details={"link_id": str(link.id), "expires_at": expires_at.isoformat() if expires_at else None},
                    ip_address=request.client.host if request.client else None)
    return ShareCreateResponse(
        token=raw_token,
        url=f"/api/v1/public/s/{raw_token}",
        expires_at=expires_at,
    )


@router.get("/share", response_model=list[ShareLinkOut])
async def list_share_links(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    bucket: str | None = None,
):
    """List share links owned by the caller (admins see all)."""
    return await share_service.list_links(db, current_user, bucket=bucket)


@router.delete("/share/{link_id}", responses={404: {"description": "Link not found"}})
async def revoke_share_link(
    link_id: uuid.UUID,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Revoke a share link. Owner or admin only."""
    link = await share_service.revoke_link(db, current_user, link_id)
    if link is None:
        raise HTTPException(status_code=404, detail="Share link not found")
    await log_audit(db, current_user, SHARE_REVOKE, bucket=link.bucket, object_key=link.object_key,
                    details={"link_id": str(link.id)},
                    ip_address=request.client.host if request.client else None)
    return {"revoked": str(link.id)}


@router.get("/public/s/{token}", responses={410: {"description": "Link expired, revoked, or unknown"}, 404: {"description": "Object not found"}})
async def serve_shared_object(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    w: int | None = Query(None, ge=1, description="Resize width (px)"),
    h: int | None = Query(None, ge=1, description="Resize height (px)"),
    fmt: str | None = Query(None, alias="format", description="webp | jpeg | png"),
    q: int | None = Query(None, ge=1, le=100, description="Quality 1-100 (webp/jpeg)"),
    fit: str | None = Query(None, description="contain (default) | cover"),
):
    """Serve an object via a share token — no authentication. Validates expiry
    and revocation, increments the access counter, and optionally transforms
    images on the fly (?w=&h=&format=&q=&fit=)."""
    try:
        link = await share_service.resolve_active_link(db, token)
    except share_service.ShareLinkGone:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail=_GONE_DETAIL)

    spec = parse_or_400(w, h, fmt, q, fit)
    if spec is not None:
        filename = link.object_key.split("/")[-1]
        return await render_transformed(
            link.bucket, link.object_key, spec,
            extra_headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )

    try:
        generator, content_type, content_length = await s3_service.stream_object(
            bucket=link.bucket, key=link.object_key
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Object not found")

    filename = link.object_key.split("/")[-1]
    headers = {
        "Cache-Control": "public, max-age=3600",
        "Content-Length": str(content_length),
        "Content-Disposition": f'inline; filename="{filename}"',
    }
    return StreamingResponse(generator, media_type=content_type, headers=headers)


@router.get("/public/{bucket_name}/{object_key:path}", include_in_schema=False)
async def serve_public_object_legacy(bucket_name: str, object_key: str):
    """Legacy untokenized public access — removed for security. Use share links."""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Untokenized public links are no longer supported. Create a share link instead.",
    )
