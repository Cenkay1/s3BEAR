import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional
import asyncio
from functools import partial

from app.core.config import settings

DEFAULT_CONTENT_TYPE = "application/octet-stream"

# Runtime S3 connection config. When None, the env-var config is used (default).
# When an admin saves a connection via Settings, it is loaded here and takes
# precedence over the environment. Shape: {access_key, secret_key, region,
# endpoint, presigned_base}.
_runtime_cfg: dict | None = None


def set_runtime_config(cfg: dict | None) -> None:
    """Install (or clear, with None) the active S3 connection config."""
    global _runtime_cfg
    _runtime_cfg = cfg


def has_runtime_config() -> bool:
    return _runtime_cfg is not None


def _cfg() -> dict:
    """Resolve the effective S3 config: runtime config if set, else env vars."""
    if _runtime_cfg is not None:
        c = _runtime_cfg
        return {
            "access_key": c.get("access_key") or settings.AWS_ACCESS_KEY_ID,
            "secret_key": c.get("secret_key") or settings.AWS_SECRET_ACCESS_KEY,
            "region": c.get("region") or settings.AWS_REGION,
            "endpoint": c.get("endpoint") or "",
            "presigned_base": c.get("presigned_base") or "",
        }
    return {
        "access_key": settings.AWS_ACCESS_KEY_ID,
        "secret_key": settings.AWS_SECRET_ACCESS_KEY,
        "region": settings.AWS_REGION,
        "endpoint": settings.AWS_ENDPOINT_URL,
        "presigned_base": settings.PRESIGNED_URL_BASE,
    }


def _make_client(cfg: dict | None = None):
    c = cfg or _cfg()
    kwargs = {
        "aws_access_key_id": c["access_key"],
        "aws_secret_access_key": c["secret_key"],
        "region_name": c["region"],
    }
    if c["endpoint"]:
        kwargs["endpoint_url"] = c["endpoint"]
    return boto3.client("s3", **kwargs)


def _make_presign_client():
    """Client that uses the external-facing URL and SigV4 for presigned URL generation.
    SigV4 is required — MinIO rejects SigV2 presigned URLs for multipart uploads."""
    c = _cfg()
    endpoint = c["presigned_base"] or c["endpoint"]
    kwargs = {
        "aws_access_key_id": c["access_key"],
        "aws_secret_access_key": c["secret_key"],
        "region_name": c["region"],
        "config": Config(signature_version="s3v4"),
    }
    if endpoint:
        kwargs["endpoint_url"] = endpoint
    return boto3.client("s3", **kwargs)


async def test_config(cfg: dict) -> None:
    """Validate an S3 config by attempting a list_buckets. Raises on failure."""
    client = _make_client(cfg)
    await _run_sync(client.list_buckets)


def _run_sync(func, *args, **kwargs):
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(None, partial(func, *args, **kwargs))


async def create_bucket(bucket_name: str) -> None:
    client = _make_client()
    try:
        await _run_sync(client.create_bucket, Bucket=bucket_name)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("BucketAlreadyExists", "BucketAlreadyOwnedByYou"):
            raise ValueError(f"Bucket '{bucket_name}' already exists")
        raise


async def delete_bucket(bucket_name: str) -> None:
    client = _make_client()
    try:
        await _run_sync(client.delete_bucket, Bucket=bucket_name)
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "NoSuchBucket":
            raise FileNotFoundError(f"Bucket '{bucket_name}' not found")
        if code == "BucketNotEmpty":
            raise ValueError(f"Bucket '{bucket_name}' is not empty")
        raise


async def list_buckets() -> list[dict]:
    client = _make_client()
    response = await _run_sync(client.list_buckets)
    return [
        {
            "name": b["Name"],
            "creation_date": b.get("CreationDate"),
        }
        for b in response.get("Buckets", [])
    ]


async def list_objects(bucket: str, prefix: str = "", delimiter: str = "/") -> dict:
    client = _make_client()
    kwargs = {"Bucket": bucket, "Delimiter": delimiter}
    if prefix:
        kwargs["Prefix"] = prefix

    objects = []
    common_prefixes = []
    continuation_token = None

    while True:
        if continuation_token:
            kwargs["ContinuationToken"] = continuation_token
        response = await _run_sync(client.list_objects_v2, **kwargs)

        for obj in response.get("Contents", []):
            if obj["Key"] == prefix:  # skip the "folder" itself
                continue
            objects.append({
                "key": obj["Key"],
                "size": obj["Size"],
                "last_modified": obj["LastModified"],
                "etag": obj.get("ETag", "").strip('"'),
            })

        for cp in response.get("CommonPrefixes", []):
            common_prefixes.append(cp["Prefix"])

        if not response.get("IsTruncated"):
            break
        continuation_token = response.get("NextContinuationToken")

    return {"objects": objects, "common_prefixes": common_prefixes}


async def put_object(bucket: str, key: str, data: bytes, content_type: str = DEFAULT_CONTENT_TYPE) -> None:
    client = _make_client()
    await _run_sync(
        client.put_object,
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )


async def delete_objects(bucket: str, keys: list[str]) -> dict:
    client = _make_client()
    delete_payload = {"Objects": [{"Key": k} for k in keys], "Quiet": False}
    response = await _run_sync(client.delete_objects, Bucket=bucket, Delete=delete_payload)
    deleted = [d["Key"] for d in response.get("Deleted", [])]
    errors = [e.get("Key", "") for e in response.get("Errors", [])]
    return {"deleted": deleted, "errors": errors}


async def stream_object(bucket: str, key: str) -> tuple[AsyncGenerator[bytes, None], str, int]:
    """Returns (async_generator, content_type, content_length)."""
    client = _make_client()

    try:
        response = await _run_sync(client.get_object, Bucket=bucket, Key=key)
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            raise FileNotFoundError(f"Object not found: {key}")
        raise

    content_type = response.get("ContentType", DEFAULT_CONTENT_TYPE)
    content_length = response.get("ContentLength", 0)
    body = response["Body"]

    async def _generator():
        chunk_size = 64 * 1024
        loop = asyncio.get_event_loop()
        while True:
            chunk = await loop.run_in_executor(None, body.read, chunk_size)
            if not chunk:
                break
            yield chunk

    return _generator(), content_type, content_length


class ObjectTooLarge(Exception):
    """Raised when an object exceeds a caller-supplied size limit."""

    def __init__(self, size: int):
        self.size = size
        super().__init__(f"Object is {size} bytes")


async def get_object_bytes(bucket: str, key: str, max_bytes: int | None = None) -> tuple[bytes, str]:
    """Read a full object into memory. Returns (data, content_type).
    Raises FileNotFoundError if missing, ObjectTooLarge if it exceeds max_bytes."""
    client = _make_client()
    try:
        response = await _run_sync(client.get_object, Bucket=bucket, Key=key)
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            raise FileNotFoundError(f"Object not found: {key}")
        raise

    content_type = response.get("ContentType", DEFAULT_CONTENT_TYPE)
    content_length = response.get("ContentLength", 0)
    body = response["Body"]
    if max_bytes is not None and content_length and content_length > max_bytes:
        body.close()
        raise ObjectTooLarge(content_length)

    data = await _run_sync(body.read)
    return data, content_type


async def get_bucket_size(bucket_name: str) -> dict:
    """Return total size and object count for a bucket."""
    client = _make_client()
    total_size = 0
    object_count = 0
    continuation_token = None

    while True:
        kwargs = {"Bucket": bucket_name}
        if continuation_token:
            kwargs["ContinuationToken"] = continuation_token
        response = await _run_sync(client.list_objects_v2, **kwargs)

        for obj in response.get("Contents", []):
            total_size += obj["Size"]
            object_count += 1

        if not response.get("IsTruncated"):
            break
        continuation_token = response.get("NextContinuationToken")

    return {"size": total_size, "object_count": object_count}


async def get_storage_stats() -> dict:
    """Return aggregate storage stats across all buckets."""
    buckets = await list_buckets()
    bucket_stats = []
    total_size = 0
    total_objects = 0

    for b in buckets:
        stats = await get_bucket_size(b["name"])
        bucket_stats.append({
            "name": b["name"],
            "size": stats["size"],
            "object_count": stats["object_count"],
        })
        total_size += stats["size"]
        total_objects += stats["object_count"]

    return {
        "total_size": total_size,
        "total_objects": total_objects,
        "bucket_count": len(buckets),
        "buckets": bucket_stats,
    }


async def create_multipart_upload(bucket: str, key: str, content_type: str = DEFAULT_CONTENT_TYPE) -> str:
    """Initiate a multipart upload. Returns the upload ID."""
    client = _make_client()
    response = await _run_sync(
        client.create_multipart_upload,
        Bucket=bucket,
        Key=key,
        ContentType=content_type,
    )
    return response["UploadId"]


MAX_MULTIPART_PARTS = 10000


async def generate_presigned_upload_urls(
    bucket: str, key: str, upload_id: str, num_parts: int
) -> list[str]:
    """Generate presigned URLs for each part of a multipart upload."""
    if num_parts < 1 or num_parts > MAX_MULTIPART_PARTS:
        raise ValueError(f"num_parts must be between 1 and {MAX_MULTIPART_PARTS}")
    client = _make_presign_client()
    urls = []
    for part_number in range(1, num_parts + 1):
        url = await _run_sync(
            client.generate_presigned_url,
            "upload_part",
            Params={
                "Bucket": bucket,
                "Key": key,
                "UploadId": upload_id,
                "PartNumber": part_number,
            },
            ExpiresIn=settings.PRESIGNED_URL_EXPIRY_SECONDS,
        )
        urls.append(url)
    return urls


async def complete_multipart_upload(
    bucket: str, key: str, upload_id: str, parts: list[dict]
) -> None:
    """Complete a multipart upload. parts = [{"PartNumber": 1, "ETag": "..."}]"""
    client = _make_client()
    await _run_sync(
        client.complete_multipart_upload,
        Bucket=bucket,
        Key=key,
        UploadId=upload_id,
        MultipartUpload={"Parts": parts},
    )


async def abort_multipart_upload(bucket: str, key: str, upload_id: str) -> None:
    """Abort a multipart upload."""
    client = _make_client()
    await _run_sync(
        client.abort_multipart_upload,
        Bucket=bucket,
        Key=key,
        UploadId=upload_id,
    )


async def generate_presigned_download_url(bucket: str, key: str) -> str:
    """Generate a presigned download URL."""
    client = _make_presign_client()
    url = await _run_sync(
        client.generate_presigned_url,
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=settings.PRESIGNED_URL_EXPIRY_SECONDS,
    )
    return url


async def copy_object(source_bucket: str, source_key: str, dest_bucket: str, dest_key: str) -> None:
    """Copy an object from source to destination."""
    client = _make_client()
    copy_source = {"Bucket": source_bucket, "Key": source_key}
    try:
        await _run_sync(client.copy_object, Bucket=dest_bucket, Key=dest_key, CopySource=copy_source)
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            raise FileNotFoundError(f"Source object not found: {source_key}")
        raise


async def move_object(source_bucket: str, source_key: str, dest_bucket: str, dest_key: str) -> None:
    """Move an object (copy + delete source)."""
    await copy_object(source_bucket, source_key, dest_bucket, dest_key)
    client = _make_client()
    await _run_sync(client.delete_object, Bucket=source_bucket, Key=source_key)


def build_dest_key(source_key: str, dest_prefix: str) -> str:
    """Compute the destination key for a bulk copy/move: dest_prefix + basename.
    Pure helper (no I/O)."""
    basename = source_key.rstrip("/").split("/")[-1]
    if not basename:
        raise ValueError("source_key has no basename")
    if dest_prefix and not dest_prefix.endswith("/"):
        dest_prefix += "/"
    return f"{dest_prefix}{basename}"


async def bulk_copy_move(
    source_bucket: str,
    keys: list[str],
    dest_bucket: str,
    dest_prefix: str,
    *,
    move: bool = False,
) -> dict:
    """Copy (or move) many objects into dest_bucket under dest_prefix. Continues
    past per-object failures. Returns {"succeeded": [dest_key...], "errors": [{key, error}...]}."""
    succeeded: list[str] = []
    errors: list[dict] = []
    for key in keys:
        try:
            dest_key = build_dest_key(key, dest_prefix)
            if dest_bucket == source_bucket and dest_key == key:
                raise ValueError("source and destination are identical")
            if move:
                await move_object(source_bucket, key, dest_bucket, dest_key)
            else:
                await copy_object(source_bucket, key, dest_bucket, dest_key)
            succeeded.append(dest_key)
        except FileNotFoundError:
            errors.append({"key": key, "error": "source not found"})
        except Exception as e:  # noqa: BLE001 — collect and continue
            errors.append({"key": key, "error": str(e)})
    return {"succeeded": succeeded, "errors": errors}


async def get_object_metadata(bucket: str, key: str) -> dict:
    client = _make_client()
    try:
        response = await _run_sync(client.head_object, Bucket=bucket, Key=key)
        return {
            "content_type": response.get("ContentType", ""),
            "content_length": response.get("ContentLength", 0),
            "last_modified": response.get("LastModified"),
            "etag": response.get("ETag", "").strip('"'),
        }
    except ClientError as e:
        if e.response["Error"]["Code"] in ("NoSuchKey", "404"):
            raise FileNotFoundError(f"Object not found: {key}")
        raise
