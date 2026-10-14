"""
Interview Evaluation and Reporting Endpoints
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Dict
from app.database import get_db
from app.auth import get_current_user
from app.models import InterviewSession, Transcript
from app.interview.voice_metrics import calculate_voice_metrics

logger = logging.getLogger(__name__)
router = APIRouter()


async def _verify_session_ownership(db: AsyncSession, session_id: str, user_id: str) -> None:
    """Verify that the session exists and belongs to the given user."""
    session = await db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied to this session")

@router.get("/sessions/{session_id}/report")
async def get_evaluation_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Reject report requests until a supported evaluation provider is available."""
    await _verify_session_ownership(db, session_id, user["id"])
    session = await db.get(InterviewSession, session_id)
    if session is not None and session.is_demo:
        raise HTTPException(status_code=409, detail="Simulated demo sessions do not have evaluations")
    raise HTTPException(
        status_code=409,
        detail="insufficient data: verified evaluation reports are not available",
    )


@router.post("/sessions/{session_id}/report/generate")
async def generate_evaluation_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Do not generate scores until a supported evaluation provider is available."""
    await _verify_session_ownership(db, session_id, user["id"])
    session = await db.get(InterviewSession, session_id)
    if session is not None and session.is_demo:
        raise HTTPException(status_code=409, detail="Simulated demo sessions do not have evaluations")
    raise HTTPException(
        status_code=409,
        detail="insufficient data: verified evaluation reports are not available",
    )


@router.get("/sessions/{session_id}/analytics")
async def get_interview_analytics(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Return measured transcript/timing metrics, with reasons when unavailable."""
    await _verify_session_ownership(db, session_id, user["id"])
    session = await db.get(InterviewSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found")
    transcript_rows = list(
        (
            await db.scalars(
                select(Transcript)
                .where(Transcript.session_id == session_id)
                .order_by(Transcript.id)
            )
        ).all()
    )
    return {
        "metrics": calculate_voice_metrics(
            [
                {
                    "speaker": row.speaker,
                    "message": row.message,
                    "language": row.language,
                    "timestamp_ms": row.timestamp_ms,
                    "duration_ms": row.duration_ms,
                }
                for row in transcript_rows
            ],
            started_at=session.started_at,
            duration_seconds=session.requested_duration_seconds,
        ),
        "source": "simulated" if session.is_demo else "real",
    }


@router.get("/sessions/{session_id}/coaching-plan", response_model=Dict[str, Any])
async def get_coaching_plan(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Get the 7-day coaching plan from the evaluation report.
    """
    await _verify_session_ownership(db, session_id, user["id"])
    # TODO: Implement coaching plan retrieval
    raise HTTPException(status_code=404, detail="Coaching plan not found")


@router.post("/sessions/{session_id}/coaching-plan/update")
async def update_coaching_progress(
    session_id: str,
    day: int,
    notes: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Update progress on the coaching plan.
    """
    await _verify_session_ownership(db, session_id, user["id"])
    # TODO: Implement coaching progress update
    return {"status": "updated", "session_id": session_id, "day": day}


@router.get("/user/reports")
async def get_user_reports(
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Return an empty history until verified evaluation reports are supported."""
    return {
        "reports": [],
        "total": 0,
        "insufficient_data": "verified evaluation reports are not available",
    }
