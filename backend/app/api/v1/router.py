from fastapi import APIRouter
from app.api.v1 import auth, buckets, objects, images, users, groups, policies, settings, share, audit, upload, tokens

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)
router.include_router(buckets.router)
router.include_router(objects.router)
router.include_router(images.router)
router.include_router(users.router)
router.include_router(groups.router)
router.include_router(policies.router)
router.include_router(settings.router)
router.include_router(share.router)
router.include_router(audit.router)
router.include_router(upload.router)
router.include_router(tokens.router)
