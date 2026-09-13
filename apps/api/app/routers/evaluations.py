"""
Interview Evaluation and Reporting Endpoints
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
from app.database import get_db
from app.auth import get_current_user
from sqlalchemy import text
from app.interview.evaluation_engine import build_evaluation

logger = logging.getLogger(__name__)
router = APIRouter()


async def _verify_session_ownership(db: AsyncSession, session_id: str, user_id: str) -> None:
    """Verify that the session exists and belongs to the given user."""
    result = await db.execute(
        text("SELECT user_id FROM interview_sessions WHERE id = :id"),
        {"id": session_id}
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    if row.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied to this session")


def _jsonb(value):
    """Serialize a value to JSON string for storage in a TEXT/JSONB column.

    Works with both SQLite (no jsonb type) and PostgreSQL.
    """
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value)


def _parse_report_row(row):
    """Parse a raw DB row mapping into a dict suitable for the response model.

    Handles SQLite (JSON stored as TEXT) and PostgreSQL (JSON stored as JSONB)
    by deserializing string fields back to Python objects.
    Also coerces integer IDs to strings.
    """
    data = dict(row)
    data["id"] = str(data["id"])
    for field in ("communication_fingerprint", "seven_day_coaching_plan", "detailed_feedback"):
        val = data.get(field)
        if isinstance(val, str):
            data[field] = json.loads(val)
    return data


class CommunicationFingerprint(BaseModel):
    """Communication fingerprint scores"""
    clarity: int  # 0-100
    conciseness: int  # 0-100
    structure: int  # 0-100
    pace: int  # 0-100
    filler_control: int  # 0-100


class EvaluationReportResponse(BaseModel):
    """Evaluation report response"""
    id: str
    session_id: str
    overall_score: int
    technical_score: int
    communication_score: int
    confidence_score: int
    clarity_score: int
    relevance_score: int
    problem_solving_score: int
    communication_fingerprint: CommunicationFingerprint
    seven_day_coaching_plan: Dict[str, str]
    top_weakness: str
    top_strength: str
    recommendation: str
    
    class Config:
        from_attributes = True


@router.get("/sessions/{session_id}/report", response_model=EvaluationReportResponse)
async def get_evaluation_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Get the evaluation report for a completed interview.

    Includes:
    - Score breakdown (Technical, Communication, Confidence, Clarity, Relevance, Problem Solving)
    - Communication Fingerprint (radar chart data)
    - 7-day Coaching Plan
    - Top weakness and strength
    """
    await _verify_session_ownership(db, session_id, user["id"])
    result = await db.execute(text("SELECT * FROM evaluation_reports WHERE session_id = :session_id"), {"session_id": session_id})
    report = result.mappings().first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return _parse_report_row(report)


@router.post("/sessions/{session_id}/report/generate", response_model=EvaluationReportResponse)
async def generate_evaluation_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Build and persist a deterministic report from candidate transcript rows."""
    await _verify_session_ownership(db, session_id, user["id"])
    rows = await db.execute(text("SELECT speaker, message, confidence_score, clarity_score, relevance_score FROM transcripts WHERE session_id = :session_id ORDER BY created_at"), {"session_id": session_id})
    report = build_evaluation([dict(row) for row in rows.mappings().all()])
    params = {
        "session_id": session_id,
        "overall_score": report["overall_score"],
        "technical_score": report["technical_score"],
        "communication_score": report["communication_score"],
        "confidence_score": report["confidence_score"],
        "clarity_score": report["clarity_score"],
        "relevance_score": report["relevance_score"],
        "problem_solving_score": report["problem_solving_score"],
        "communication_fingerprint": _jsonb(report["communication_fingerprint"]),
        "seven_day_coaching_plan": _jsonb(report["seven_day_coaching_plan"]),
        "top_weakness": report["top_weakness"],
        "top_strength": report["top_strength"],
        "recommendation": report["recommendation"],
        "detailed_feedback": _jsonb(report["detailed_feedback"]),
    }
    await db.execute(text("""
        INSERT INTO evaluation_reports (session_id, overall_score, technical_score, communication_score, confidence_score, clarity_score, relevance_score, problem_solving_score, communication_fingerprint, seven_day_coaching_plan, top_weakness, top_strength, recommendation, detailed_feedback)
        VALUES (:session_id, :overall_score, :technical_score, :communication_score, :confidence_score, :clarity_score, :relevance_score, :problem_solving_score, :communication_fingerprint, :seven_day_coaching_plan, :top_weakness, :top_strength, :recommendation, :detailed_feedback)
        ON CONFLICT (session_id) DO UPDATE SET overall_score = EXCLUDED.overall_score, technical_score = EXCLUDED.technical_score, communication_score = EXCLUDED.communication_score, confidence_score = EXCLUDED.confidence_score, clarity_score = EXCLUDED.clarity_score, relevance_score = EXCLUDED.relevance_score, problem_solving_score = EXCLUDED.problem_solving_score, communication_fingerprint = EXCLUDED.communication_fingerprint, seven_day_coaching_plan = EXCLUDED.seven_day_coaching_plan, detailed_feedback = EXCLUDED.detailed_feedback
    """), params)
    await db.commit()
    result = await db.execute(text("SELECT * FROM evaluation_reports WHERE session_id = :session_id"), {"session_id": session_id})
    return _parse_report_row(result.mappings().first())


@router.get("/sessions/{session_id}/analytics")
async def get_interview_analytics(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Get detailed analytics for an interview.

    Includes:
    - Average WPM
    - Pause analysis
    - Filler word frequency
    - State transitions
    - Difficulty adjustments
    """
    await _verify_session_ownership(db, session_id, user["id"])
    result = await db.execute(text("SELECT COUNT(*) AS transcript_count, COALESCE(AVG(words_per_minute), 0) AS avg_wpm, COALESCE(SUM(filler_word_count), 0) AS total_filler_words FROM transcripts WHERE session_id = :session_id"), {"session_id": session_id})
    analytics = result.mappings().first()
    if not analytics or analytics["transcript_count"] == 0:
        raise HTTPException(status_code=404, detail="Analytics not found")
    return dict(analytics)


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
    limit: int = 10,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Get all evaluation reports for the current user.
    """
    result = await db.execute(
        text("SELECT er.* FROM evaluation_reports er JOIN interview_sessions s ON er.session_id = s.id WHERE s.user_id = :user_id ORDER BY er.created_at DESC LIMIT :limit OFFSET :offset"),
        {"user_id": user["id"], "limit": limit, "offset": offset}
    )
    reports = [_parse_report_row(row) for row in result.mappings().all()]
    return {"reports": reports, "total": len(reports)}
