"""Liveness and dependency readiness endpoints."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from app.config import settings
from app.database import engine

router = APIRouter()


def _dependency_status(configured: bool, partially_configured: bool = False) -> dict[str, str]:
    if configured:
        return {"status": "ok"}
    if partially_configured:
        return {"status": "degraded"}
    return {"status": "disabled"}


@router.get("/ready", tags=["Health"])
async def health_check():
    """Check database connectivity and report optional provider configuration."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Service unavailable") from exc

    agora_any = bool(settings.AGORA_APP_ID or settings.AGORA_APP_CERTIFICATE)
    clerk_any = bool(settings.CLERK_SECRET_KEY or settings.CLERK_JWT_JWKS_URL)
    return {
        "status": "ready",
        "service": "voicehire-api",
        "dependencies": {
            "database": {"status": "ok"},
            "redis": {"status": "disabled", "reason": "Redis is not used by the API."},
            "openai": _dependency_status(settings.openai_enabled, bool(settings.OPENAI_API_KEY)),
            "agora": _dependency_status(settings.agora_enabled, agora_any),
            "clerk": _dependency_status(settings.clerk_enabled, clerk_any),
        },
        "demo_mode": settings.DEMO_MODE,
    }


@router.get("/live", tags=["Health"])
async def liveness_check():
    """Indicate that the API process is alive without checking dependencies."""
    return {"status": "alive", "service": "voicehire-api"}
