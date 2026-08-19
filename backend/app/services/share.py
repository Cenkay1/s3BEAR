"""Share-link service.

Public objects are exposed only through opaque, revocable, expiring tokens.
The raw token is shown once at creation; only its SHA-256 hash is persisted.

The pure helpers (generate_token / hash_token / parse_expires_in) intentionally
depend only on the standard library so they can be unit-tested in isolation.
DB-touching helpers import models lazily.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # avoid importing SQLAlchemy at module load
    import uuid
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.models.share import ShareLink
    from app.models.user import User

DEFAULT_EXPIRES_IN = "7d"
_UNIT_SECONDS = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}


class ShareLinkGone(Exception):
    """Raised when a share link is missing, expired, or revoked."""


# --- pure helpers -----------------------------------------------------------

def generate_token() -> str:
    """A URL-safe, high-entropy opaque token (~43 chars)."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 hex digest used for at-rest storage and lookup."""
    return hashlib.sha256(token.encode()).hexdigest()


def _seconds_from(value: str | int | None) -> int | None:
    """Normalize an expires_in value to a positive number of seconds, or None
    for 'never'. Raises ValueError on malformed input."""
    if value is None:
        return None
    if isinstance(value, bool):  # bool is an int subclass; reject explicitly
        raise ValueError(f"Invalid expires_in: {value!r}")
    if isinstance(value, int):
        seconds = value
    else:
        v = value.strip().lower()
        if v == "":
            v = DEFAULT_EXPIRES_IN
        if v == "never":
            return None
        if v.isdigit():
            seconds = int(v)
        elif len(v) >= 2 and v[-1] in _UNIT_SECONDS and v[:-1].isdigit():
            seconds = int(v[:-1]) * _UNIT_SECONDS[v[-1]]
        else:
            raise ValueError(f"Invalid expires_in: {value!r}")
    if seconds <= 0:
        raise ValueError("expires_in must be a positive duration")
    return seconds


def parse_expires_in(value: str | int | None = None) -> datetime | None:
    """Resolve an expires_in shorthand ('1h'/'24h'/'7d'/'30d'), integer seconds,
    numeric string, '' (default 7d), or None/'never' into an absolute UTC
    expiry datetime, or None for links that never expire."""
    seconds = _seconds_from(value)
    if seconds is None:
        return None
    return datetime.now(timezone.utc) + timedelta(seconds=seconds)


# --- DB-touching helpers ----------------------------------------------------

async def create_share_link(
    db: "AsyncSession",
    user: "User",
    bucket: str,
    object_key: str,
    expires_at: datetime | None,
) -> tuple["ShareLink", str]:
    """Create a share link. Returns (link, raw_token). The raw token is only
    available here — the DB stores its hash."""
    from app.models.share import ShareLink

    raw_token = generate_token()
    link = ShareLink(
        token_hash=hash_token(raw_token),
        bucket=bucket,
        object_key=object_key,
        created_by_user_id=user.id,
        created_by_email=user.email,
        expires_at=expires_at,
    )
    db.add(link)
    await db.flush()
    return link, raw_token


async def resolve_active_link(db: "AsyncSession", token: str) -> "ShareLink":
    """Look up a link by raw token and validate it. Increments access counters.
    Raises ShareLinkGone if missing, revoked, or expired."""
    from sqlalchemy import select
    from app.models.share import ShareLink

    result = await db.execute(
        select(ShareLink).where(ShareLink.token_hash == hash_token(token))
    )
    link = result.scalar_one_or_none()
    if link is None or link.revoked:
        raise ShareLinkGone()
    now = datetime.now(timezone.utc)
    if link.expires_at is not None and link.expires_at <= now:
        raise ShareLinkGone()

    link.access_count += 1
    link.last_accessed_at = now
    await db.flush()
    return link


async def list_links(db: "AsyncSession", user: "User", bucket: str | None = None):
    """List share links visible to the user (own links; admins see all)."""
    from sqlalchemy import select
    from app.models.share import ShareLink

    stmt = select(ShareLink).order_by(ShareLink.created_at.desc())
    if not user.is_admin:
        stmt = stmt.where(ShareLink.created_by_user_id == user.id)
    if bucket:
        stmt = stmt.where(ShareLink.bucket == bucket)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def revoke_link(db: "AsyncSession", user: "User", link_id: "uuid.UUID") -> "ShareLink | None":
    """Revoke a link if the user owns it or is admin. Returns the link, or None
    if not found / not permitted."""
    from sqlalchemy import select
    from app.models.share import ShareLink

    result = await db.execute(select(ShareLink).where(ShareLink.id == link_id))
    link = result.scalar_one_or_none()
    if link is None:
        return None
    if not user.is_admin and link.created_by_user_id != user.id:
        return None
    if not link.revoked:
        link.revoked = True
        link.revoked_at = datetime.now(timezone.utc)
        await db.flush()
    return link
