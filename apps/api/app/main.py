"""
FastAPI entry point. Boots even if database, AI, or voice services are down.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.database import init_db, close_db, async_session
from app.routers import health, agora, interviews, evaluations, users, phase4, agora_events, stt
from app.models import EvaluationReport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone


async def _startup_cleanup_stale_evaluations() -> None:
    """Mark leftover 'processing' evaluation reports as 'failed' on startup."""
    async with async_session() as session:
        result = await session.execute(
            select(EvaluationReport).where(EvaluationReport.status == "processing")
        )
        stale = result.scalars().all()
        now = datetime.now(timezone.utc)
        for report in stale:
            report.status = "failed"
            report.error = (
                "Evaluation was interrupted; no assessment was stored."
            )
        if stale:
            await session.commit()
            print(
                f"[Startup] Marked {len(stale)} leftover processing evaluation(s) as failed."
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    print("[Startup] VoiceHire backend starting...")
    missing_optional = []
    if not settings.GROQ_API_KEY:
        missing_optional.append("GROQ_API_KEY")
    if not settings.DEEPGRAM_API_KEY:
        missing_optional.append("DEEPGRAM_API_KEY")
    if not settings.AGORA_APP_ID:
        missing_optional.append("AGORA_APP_ID")
    if missing_optional:
        print(f"[Startup] Optional provider keys not set: {', '.join(missing_optional)} — running in demo/degraded mode.")
    else:
        print("[Startup] All optional provider keys are set.")
    await init_db()
    await _startup_cleanup_stale_evaluations()
    yield
    await close_db()
    print("[Shutdown] VoiceHire backend stopped.")


app = FastAPI(
    title="VoiceHire API",
    description="Real-time AI interview performance engine",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Trusted Hosts ──
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hosts_list,
)

# ── Routers ──
app.include_router(health.router, prefix="/api/health")
app.include_router(stt.router, prefix="/api/stt")
app.include_router(agora.router, prefix="/api/agora")
app.include_router(interviews.router, prefix="/api/interviews")
app.include_router(evaluations.router, prefix="/api/evaluations")
app.include_router(users.router, prefix="/api/users")
app.include_router(phase4.router, prefix="/api/candidates")
app.include_router(agora_events.router, prefix="/api/agora/events")


@app.get("/")
async def root():
    return {
        "service": "VoiceHire API",
        "status": "running",
        "mode": "live" if not settings.DEMO_MODE else "demo",
        "features": {
            "groq": settings.groq_enabled,
            "deepgram": settings.deepgram_enabled,
            "agora": settings.agora_enabled,
            "postgres": settings.is_postgres,
        },
    }


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "mode": "demo" if settings.DEMO_MODE else "live"}
