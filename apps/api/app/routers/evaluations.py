"""
Interview Evaluation and Reporting Endpoints
"""

import json
import logging
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
from app.database import get_db
from app.auth import get_current_user
from app.interview.evaluation_engine import build_evaluation
from app.idempotency import cached_response, store_response
from app.models import EvaluationReport, InterviewSession, Transcript

logger = logging.getLogger(__name__)
router = APIRouter()


async def _verify_session_ownership(db: AsyncSession, session_id: str, user_id: str) -> None:
    """Verify that the session exists and belongs to the given user."""
    session = await db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied to this session")

def _parse_report_row(row):
    """Convert a report model or mapping to the response-model dictionary."""
    if isinstance(row, EvaluationReport):
        data = {
            column.name: getattr(row, column.key)
            for column in EvaluationReport.__table__.columns
        }
    else:
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
    report = await db.scalar(
        select(EvaluationReport).where(EvaluationReport.session_id == session_id)
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return _parse_report_row(report)


@router.post("/sessions/{session_id}/report/generate", response_model=EvaluationReportResponse)
async def generate_evaluation_report(
    session_id: str,
    idempotency_key: str | None = Header(
        default=None, alias="Idempotency-Key", max_length=255
    ),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Build and persist a deterministic report from candidate transcript rows."""
    await _verify_session_ownership(db, session_id, user["id"])
    operation = f"report.generate:{session_id}"
    cached = await cached_response(db, user["id"], operation, idempotency_key)
    if cached is not None:
        return cached

    transcript_rows = await db.scalars(
        select(Transcript)
        .where(Transcript.session_id == session_id)
        .order_by(Transcript.created_at, Transcript.id)
    )
    evaluation = build_evaluation(
        [
            {
                "speaker": row.speaker,
                "message": row.message,
                "confidence_score": row.confidence_score,
                "clarity_score": row.clarity_score,
                "relevance_score": row.relevance_score,
            }
            for row in transcript_rows.all()
        ]
    )
    report_row = await db.scalar(
        select(EvaluationReport).where(EvaluationReport.session_id == session_id)
    )
    if report_row is None:
        report_row = EvaluationReport(session_id=session_id)
        db.add(report_row)
    for field in (
        "overall_score",
        "technical_score",
        "communication_score",
        "confidence_score",
        "clarity_score",
        "relevance_score",
        "problem_solving_score",
        "communication_fingerprint",
        "seven_day_coaching_plan",
        "top_weakness",
        "top_strength",
        "recommendation",
        "detailed_feedback",
    ):
        setattr(report_row, field, evaluation[field])
    await db.flush()
    response = _parse_report_row(report_row)
    idempotent_response = EvaluationReportResponse.model_validate(
        report_row
    ).model_dump(mode="json")
    await store_response(
        db, user["id"], operation, idempotency_key, session_id, idempotent_response
    )
    await db.commit()
    return response


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
    result = await db.execute(
        select(
            func.count(Transcript.id).label("transcript_count"),
            func.coalesce(func.avg(Transcript.words_per_minute), 0).label("avg_wpm"),
            func.coalesce(func.sum(Transcript.filler_word_count), 0).label(
                "total_filler_words"
            ),
        ).where(Transcript.session_id == session_id)
    )
    analytics = result.mappings().one()
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
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Get all evaluation reports for the current user.
    """
    result = await db.scalars(
        select(EvaluationReport)
        .join(InterviewSession, EvaluationReport.session_id == InterviewSession.id)
        .where(InterviewSession.user_id == user["id"])
        .order_by(EvaluationReport.created_at.desc(), EvaluationReport.id.desc())
        .limit(limit)
        .offset(offset)
    )
    reports = [_parse_report_row(row) for row in result.all()]
    return {"reports": reports, "total": len(reports)}
