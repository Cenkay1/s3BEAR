from fnmatch import fnmatch
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Path, status
from fastapi.responses import StreamingResponse

from app.api.deps import get_current_user
from app.models.user import User
from app.services import s3 as s3_service

router = APIRouter(prefix="/images", tags=["images"])

ALLOWED_CONTENT_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "image/svg+xml", "image/bmp", "image/tiff", "image/avif",
}


def _check_read(user: User, bucket_name: str) -> None:
    if user.is_admin:
        return
    for group in user.groups:
        for perm in group.permissions:
            if fnmatch(bucket_name, perm.bucket_pattern) and perm.can_read:
                return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"No 'read' permission for bucket '{bucket_name}'",
    )


@router.get("/{bucket_name}/{object_key:path}", responses={403: {"description": "No read permission"}, 404: {"description": "Object not found"}, 415: {"description": "Not an image"}})
async def proxy_image(
    bucket_name: str,
    object_key: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    _check_read(current_user, bucket_name)

    try:
        generator, content_type, content_length = await s3_service.stream_object(
            bucket=bucket_name, key=object_key
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Object not found")

    if content_type not in ALLOWED_CONTENT_TYPES:
        # Try to infer from key extension
        import mimetypes
        guessed, _ = mimetypes.guess_type(object_key)
        if not guessed or guessed not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=415, detail="Not an image")
        content_type = guessed

    headers = {
        "Cache-Control": "public, max-age=3600",
        "Content-Length": str(content_length),
    }
    return StreamingResponse(generator, media_type=content_type, headers=headers)
