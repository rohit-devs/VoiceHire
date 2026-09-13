"""
Health Check Endpoints
"""

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from app.database import engine

router = APIRouter()


@router.get("/ready", tags=["Health"])
async def health_check():
    """
    Readiness probe - checks if service is ready to handle traffic.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "service": "voicehire-api"}
    except Exception as e:
        raise HTTPException(status_code=503, detail="Service unavailable")


@router.get("/live", tags=["Health"])
async def liveness_check():
    """
    Liveness probe - checks if service is running.
    """
    return {"status": "alive", "service": "voicehire-api"}
