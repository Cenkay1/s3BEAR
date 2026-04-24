from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.services import s3 as s3_service

router = APIRouter(tags=["public"])


@router.get("/public/{bucket_name}/{object_key:path}", responses={404: {"description": "Object not found"}})
async def serve_public_object(bucket_name: str, object_key: str):
    """Serve an object publicly without authentication."""
    try:
        generator, content_type, content_length = await s3_service.stream_object(
            bucket=bucket_name, key=object_key
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Object not found")

    headers = {
        "Cache-Control": "public, max-age=3600",
        "Content-Length": str(content_length),
        "Content-Disposition": f'inline; filename="{object_key.split("/")[-1]}"',
    }
    return StreamingResponse(generator, media_type=content_type, headers=headers)
