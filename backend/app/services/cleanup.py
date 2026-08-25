from datetime import datetime, timezone, timedelta
from fnmatch import fnmatch
from typing import Optional

from app.services import s3 as s3_service


def _should_delete(obj: dict, cutoff: Optional[datetime]) -> bool:
    """Check if an object is eligible for deletion based on age cutoff."""
    if cutoff is None:
        return True
    last_modified = obj["last_modified"]
    if last_modified.tzinfo is None:
        last_modified = last_modified.replace(tzinfo=timezone.utc)
    return last_modified < cutoff


async def _delete_bucket_objects(
    bucket: str, prefix: str, cutoff: Optional[datetime],
) -> tuple[int, list[str]]:
    """Delete eligible objects in a bucket. Returns (deleted_count, errors)."""
    data = await s3_service.list_objects(bucket=bucket, prefix=prefix, delimiter="")
    keys_to_delete = [obj["key"] for obj in data["objects"] if _should_delete(obj, cutoff)]

    deleted_count = 0
    errors: list[str] = []
    for i in range(0, len(keys_to_delete), 1000):
        batch = keys_to_delete[i : i + 1000]
        result = await s3_service.delete_objects(bucket=bucket, keys=batch)
        deleted_count += len(result["deleted"])
        errors.extend(result["errors"])
    return deleted_count, errors


async def _buckets_matching_tag(tag_key: str, tag_value: Optional[str]) -> set[str]:
    """Return bucket names that carry the given tag (value optional = any value)."""
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.bucket_tag import BucketTag

    async with AsyncSessionLocal() as db:
        stmt = select(BucketTag.bucket_name).where(BucketTag.key == tag_key)
        if tag_value:
            stmt = stmt.where(BucketTag.value == tag_value)
        rows = (await db.execute(stmt)).scalars().all()
    return set(rows)


async def run_policy(
    policy_id: str,
    prefix_filter: Optional[str],
    older_than_days: Optional[int],
    target_type: str = "pattern",
    bucket_patterns: Optional[list[str]] = None,
    tag_key: Optional[str] = None,
    tag_value: Optional[str] = None,
) -> dict:
    """Execute cleanup for a single policy. Returns dict with deleted_count and status."""
    all_buckets = await s3_service.list_buckets()

    if target_type == "tag" and tag_key:
        tagged = await _buckets_matching_tag(tag_key, tag_value)
        target_buckets = [b["name"] for b in all_buckets if b["name"] in tagged]
    else:
        patterns = bucket_patterns or []
        target_buckets = [
            b["name"]
            for b in all_buckets
            if any(fnmatch(b["name"], pattern) for pattern in patterns)
        ]

    cutoff = None
    if older_than_days is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)

    deleted_count = 0
    errors: list[str] = []

    for bucket in target_buckets:
        try:
            count, errs = await _delete_bucket_objects(bucket, prefix_filter or "", cutoff)
            deleted_count += count
            errors.extend(errs)
        except Exception as e:
            errors.append(f"{bucket}: {str(e)}")

    status = "success" if not errors else ("partial" if deleted_count > 0 else "error")
    return {
        "deleted_count": deleted_count,
        "status": status,
        "errors": errors,
    }
