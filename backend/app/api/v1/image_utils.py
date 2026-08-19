"""Shared helper for endpoints that can transform an image on the fly.

Keeps the streaming fast-path untouched when no transform is requested, and
returns a fully-buffered transformed Response otherwise.
"""
from fastapi import HTTPException, status
from fastapi.responses import Response

from app.core.config import settings
from app.services import imaging
from app.services import s3 as s3_service


def parse_or_400(w, h, fmt, q, fit) -> "imaging.TransformSpec | None":
    try:
        return imaging.parse_transform_params(w=w, h=h, fmt=fmt, q=q, fit=fit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


async def render_transformed(bucket: str, key: str, spec, extra_headers: dict | None = None) -> Response:
    """Fetch the object, transform it per spec, and return a buffered Response.
    Raises HTTPException(404) if missing, 413 if too large, 415 if not an image."""
    max_bytes = settings.MAX_IMAGE_TRANSFORM_MB * 1024 * 1024
    try:
        data, _ = await s3_service.get_object_bytes(bucket, key, max_bytes=max_bytes)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Object not found")
    except s3_service.ObjectTooLarge:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds the {settings.MAX_IMAGE_TRANSFORM_MB}MB transform limit",
        )

    try:
        out, content_type = imaging.transform_image(data, spec)
    except imaging.UnsupportedImage:
        raise HTTPException(status_code=415, detail="Cannot transform this image type")

    headers = {"Cache-Control": "public, max-age=3600"}
    if extra_headers:
        headers.update(extra_headers)
    return Response(content=out, media_type=content_type, headers=headers)
