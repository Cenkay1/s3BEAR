import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.models.user import User
from app.models.webhook import WebhookEndpoint, WebhookDelivery
from app.schemas.webhook import (
    WebhookCreateRequest, WebhookCreateResponse, WebhookDeliveryOut,
    WebhookOut, WebhookUpdateRequest,
)
from app.services import webhook as webhook_service
from app.services.audit import log_audit, WEBHOOK_CREATE, WEBHOOK_UPDATE, WEBHOOK_DELETE

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


async def _get_endpoint(db: AsyncSession, webhook_id: uuid.UUID) -> WebhookEndpoint:
    result = await db.execute(select(WebhookEndpoint).where(WebhookEndpoint.id == webhook_id))
    ep = result.scalar_one_or_none()
    if ep is None:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return ep


@router.post("", response_model=WebhookCreateResponse)
async def create_webhook(
    body: WebhookCreateRequest,
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Register a webhook endpoint. The signing secret is returned only once."""
    ep = WebhookEndpoint(
        name=body.name,
        url=body.url,
        secret=body.secret or webhook_service.generate_secret(),
        events=body.events,
        created_by_user_id=admin.id,
    )
    db.add(ep)
    await db.flush()
    await log_audit(db, admin, WEBHOOK_CREATE,
                    details={"webhook_id": str(ep.id), "name": ep.name, "url": ep.url, "events": ep.events},
                    ip_address=request.client.host if request.client else None)
    return ep


@router.get("", response_model=list[WebhookOut])
async def list_webhooks(
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(WebhookEndpoint).order_by(WebhookEndpoint.created_at.desc()))
    return list(result.scalars().all())


@router.patch("/{webhook_id}", response_model=WebhookOut)
async def update_webhook(
    webhook_id: uuid.UUID,
    body: WebhookUpdateRequest,
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ep = await _get_endpoint(db, webhook_id)
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(ep, field, value)
    await db.flush()
    await log_audit(db, admin, WEBHOOK_UPDATE,
                    details={"webhook_id": str(ep.id), "changes": list(changes.keys())},
                    ip_address=request.client.host if request.client else None)
    return ep


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: uuid.UUID,
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ep = await _get_endpoint(db, webhook_id)
    await db.delete(ep)
    await log_audit(db, admin, WEBHOOK_DELETE,
                    details={"webhook_id": str(webhook_id), "name": ep.name},
                    ip_address=request.client.host if request.client else None)
    return {"deleted": str(webhook_id)}


@router.get("/{webhook_id}/deliveries", response_model=list[WebhookDeliveryOut])
async def list_deliveries(
    webhook_id: uuid.UUID,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
):
    await _get_endpoint(db, webhook_id)
    result = await db.execute(
        select(WebhookDelivery)
        .where(WebhookDelivery.endpoint_id == webhook_id)
        .order_by(WebhookDelivery.created_at.desc())
        .limit(min(limit, 200))
    )
    return list(result.scalars().all())


@router.post("/{webhook_id}/test", response_model=WebhookDeliveryOut)
async def test_webhook(
    webhook_id: uuid.UUID,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Enqueue a synthetic delivery so the endpoint can be verified. The scheduler
    dispatches it within ~20 seconds."""
    ep = await _get_endpoint(db, webhook_id)
    payload = webhook_service.build_payload(
        event="ping", user_id=str(admin.id), user_email=admin.email,
        bucket=None, object_key=None, details={"test": True},
    )
    delivery = WebhookDelivery(endpoint_id=ep.id, event="ping", payload=payload,
                               status=webhook_service.STATUS_PENDING, attempts=0)
    db.add(delivery)
    await db.flush()
    return delivery
