import json
import logging
import os
from datetime import datetime, timezone

import aiofiles
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.audit import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)

# Action constants
UPLOAD = "upload"
DELETE = "delete"
DOWNLOAD = "download"
CREATE_BUCKET = "create_bucket"
DELETE_BUCKET = "delete_bucket"
USER_CREATE = "user_create"
USER_DELETE = "user_delete"
PERMISSION_CHANGE = "permission_change"
COPY = "copy"
MOVE = "move"
CLEANUP = "cleanup"
SHARE_CREATE = "share_create"
SHARE_REVOKE = "share_revoke"
TOKEN_CREATE = "token_create"
TOKEN_REVOKE = "token_revoke"
WEBHOOK_CREATE = "webhook_create"
WEBHOOK_UPDATE = "webhook_update"
WEBHOOK_DELETE = "webhook_delete"


async def _write_audit_to_file(
    timestamp: datetime,
    user_id: str | None,
    user_email: str,
    action: str,
    bucket: str | None,
    object_key: str | None,
    details: dict | None,
    ip_address: str | None,
) -> None:
    """Write audit log entry to a date-partitioned JSONL file."""
    if not settings.AUDIT_LOG_FILE_ENABLED:
        return

    date_path = timestamp.strftime("%Y/%m/%d")
    log_dir = os.path.join(settings.AUDIT_LOG_PATH, date_path)
    os.makedirs(log_dir, exist_ok=True)

    log_file = os.path.join(log_dir, "audit.jsonl")
    entry = {
        "timestamp": timestamp.isoformat(),
        "user_id": user_id,
        "user_email": user_email,
        "action": action,
        "bucket": bucket,
        "object_key": object_key,
        "details": details,
        "ip_address": ip_address,
    }

    async with aiofiles.open(log_file, mode="a") as f:
        await f.write(json.dumps(entry, default=str) + "\n")


async def log_audit(
    db: AsyncSession,
    user: User | None,
    action: str,
    bucket: str | None = None,
    object_key: str | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
) -> None:
    if not settings.AUDIT_LOG_ENABLED:
        return

    user_id = str(user.id) if user else None
    user_email = user.email if user else "system"
    now = datetime.now(timezone.utc)

    # DB write
    entry = AuditLog(
        user_id=user.id if user else None,
        user_email=user_email,
        action=action,
        bucket=bucket,
        object_key=object_key,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    await db.flush()

    # Enqueue webhook deliveries for subscribed endpoints (same transaction, so a
    # rolled-back request produces no deliveries). Best-effort: never fail the request.
    try:
        from app.services import webhook as webhook_service
        payload = webhook_service.build_payload(
            event=action, user_id=user_id, user_email=user_email,
            bucket=bucket, object_key=object_key, details=details,
        )
        await webhook_service.enqueue_event(db, action, payload)
    except Exception:
        logger.exception("Failed to enqueue webhook deliveries")

    # File write (non-blocking, never fails the request)
    try:
        await _write_audit_to_file(
            timestamp=now,
            user_id=user_id,
            user_email=user_email,
            action=action,
            bucket=bucket,
            object_key=object_key,
            details=details,
            ip_address=ip_address,
        )
    except Exception:
        logger.exception("Failed to write audit log to file")


async def _cleanup_db(cutoff: datetime) -> int:
    """Delete audit log rows older than cutoff. Returns number of deleted rows."""
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            delete(AuditLog).where(AuditLog.created_at < cutoff)
        )
        await db.commit()
        return result.rowcount


def _cleanup_day_dir(day_path: str, year: str, month: str, day: str, cutoff: datetime) -> bool:
    """Remove a day directory if it's older than cutoff. Returns True if removed."""
    import shutil

    try:
        dir_date = datetime(int(year), int(month), int(day), tzinfo=timezone.utc)
    except ValueError:
        return False
    if dir_date < cutoff:
        shutil.rmtree(day_path, ignore_errors=True)
        return True
    return False


def _is_digit_dir(parent: str, name: str) -> bool:
    """Check if name is a digit-only directory under parent."""
    return name.isdigit() and os.path.isdir(os.path.join(parent, name))


def _cleanup_year(year_path: str, year_dir: str, cutoff: datetime) -> int:
    """Clean up all expired day directories under a year directory."""
    fs_deleted = 0
    for month_dir in _safe_listdir(year_path):
        if not _is_digit_dir(year_path, month_dir):
            continue
        month_path = os.path.join(year_path, month_dir)
        for day_dir in _safe_listdir(month_path):
            if not _is_digit_dir(month_path, day_dir):
                continue
            day_path = os.path.join(month_path, day_dir)
            if _cleanup_day_dir(day_path, year_dir, month_dir, day_dir, cutoff):
                fs_deleted += 1
    _remove_empty_parents(year_path)
    return fs_deleted


def _cleanup_filesystem(audit_path: str, cutoff: datetime) -> int:
    """Remove date-partitioned directories older than cutoff. Returns count of removed dirs."""
    if not os.path.exists(audit_path):
        return 0

    fs_deleted = 0
    for year_dir in _safe_listdir(audit_path):
        if not _is_digit_dir(audit_path, year_dir):
            continue
        year_path = os.path.join(audit_path, year_dir)
        fs_deleted += _cleanup_year(year_path, year_dir, cutoff)
    return fs_deleted


async def cleanup_old_audit_logs(retention_days: int | None = None) -> dict:
    """Delete audit logs older than retention_days from both DB and filesystem."""
    from datetime import timedelta

    days = retention_days or settings.AUDIT_LOG_RETENTION_DAYS
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    db_deleted = await _cleanup_db(cutoff)
    fs_deleted = _cleanup_filesystem(settings.AUDIT_LOG_PATH, cutoff)

    logger.info(
        "Audit log cleanup: deleted %d DB rows, %d filesystem directories (retention=%d days)",
        db_deleted, fs_deleted, days,
    )
    return {"db_deleted": db_deleted, "fs_directories_deleted": fs_deleted}


def _safe_listdir(path: str) -> list[str]:
    try:
        return os.listdir(path)
    except OSError:
        return []


def _remove_empty_parents(path: str) -> None:
    """Remove directory if empty, then check parent."""
    try:
        for month_dir in _safe_listdir(path):
            month_path = os.path.join(path, month_dir)
            if os.path.isdir(month_path) and not _safe_listdir(month_path):
                os.rmdir(month_path)
        if not _safe_listdir(path):
            os.rmdir(path)
    except OSError:
        pass
