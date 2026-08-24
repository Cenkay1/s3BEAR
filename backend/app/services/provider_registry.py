"""Loads storage providers and the bucket→provider routing map from the DB into
the s3 service's in-memory registry. Called at startup and after any provider or
bucket mutation so routing always reflects the current configuration."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.provider import StorageProvider, ManagedBucket
from app.services import s3 as s3_service


def _to_cfg(p: StorageProvider) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "access_key": p.access_key_id,
        "secret_key": p.secret_access_key,
        "region": p.region,
        "endpoint": p.endpoint_url,
        "presigned_base": p.presigned_base,
        "use_ssl": p.use_ssl,
    }


async def reload_registry(db: AsyncSession) -> None:
    """Refresh the s3 service registry from the database."""
    providers = (await db.execute(select(StorageProvider))).scalars().all()
    default_id = next((str(p.id) for p in providers if p.is_default), None)
    s3_service.set_providers([_to_cfg(p) for p in providers], default_id)

    mappings = (await db.execute(select(ManagedBucket))).scalars().all()
    s3_service.set_bucket_map({m.name: str(m.provider_id) for m in mappings})
