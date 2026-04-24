from contextlib import asynccontextmanager
import logging
import secrets as secrets_module

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.api.v1.router import router

logging.basicConfig(level=logging.INFO if not settings.DEBUG else logging.DEBUG)
logger = logging.getLogger(__name__)


async def _seed_default_admin() -> None:
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.core.security import get_password_hash
    from app.models.user import User

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.is_admin == True))  # noqa: E712
        if result.scalars().first():
            return  # admin already exists

        password = settings.DEFAULT_ADMIN_PASSWORD
        if not password or password == "admin":
            password = secrets_module.token_urlsafe(16)
            logger.warning("Generated random admin password: %s", password)

        admin = User(
            email=settings.DEFAULT_ADMIN_EMAIL,
            display_name="Admin",
            is_admin=True,
            is_active=True,
            password_hash=get_password_hash(password),
        )
        db.add(admin)
        await db.commit()
        logger.info("Default admin user created: %s", settings.DEFAULT_ADMIN_EMAIL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from app.worker.scheduler import start_scheduler, load_all_policies
    start_scheduler()
    await load_all_policies()
    await _seed_default_admin()
    logger.info("s3BEAR started")
    yield
    # Shutdown
    from app.worker.scheduler import stop_scheduler
    stop_scheduler()
    logger.info("s3BEAR stopped")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiter setup
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok"}
