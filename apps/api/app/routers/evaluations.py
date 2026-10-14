"""
Interview Evaluation and Reporting Endpoints
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
from app.database import get_db
from app.auth import get_current_user
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


def _analysis_is_complete(session_id):
    candidate_responses = exists(
        select(Transcript.id).where(
            Transcript.session_id == session_id,
            Transcript.speaker == "candidate",
        )
    )
    unanalyzed_responses = exists(
        select(Transcript.id).where(
            Transcript.session_id == session_id,
            Transcript.speaker == "candidate",
            or_(
                Transcript.confidence_score.is_(None),
                Transcript.clarity_score.is_(None),
                Transcript.relevance_score.is_(None),
            ),
        )
    )
    return candidate_responses & ~unanalyzed_responses


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
    session = await db.get(InterviewSession, session_id)
    if session is not None and session.is_demo:
        raise HTTPException(status_code=409, detail="Simulated demo sessions do not have evaluations")
    report = await db.scalar(
        select(EvaluationReport)
        .where(
            EvaluationReport.session_id == session_id,
            _analysis_is_complete(EvaluationReport.session_id),
        )
    )
    if not report:
        raise HTTPException(
            status_code=409,
            detail="insufficient data: no report is available without analyzed candidate responses",
        )
    return _parse_report_row(report)


@router.post("/sessions/{session_id}/report/generate", response_model=EvaluationReportResponse)
async def generate_evaluation_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Generate a report only when real response analysis data is available."""
    await _verify_session_ownership(db, session_id, user["id"])
    session = await db.get(InterviewSession, session_id)
    if session is not None and session.is_demo:
        raise HTTPException(status_code=409, detail="Simulated demo sessions do not have evaluations")
    transcript_rows = await db.scalars(
        select(Transcript)
        .where(Transcript.session_id == session_id)
        .order_by(Transcript.created_at, Transcript.id)
    )
    candidate_rows = [row for row in transcript_rows.all() if row.speaker == "candidate"]
    if not candidate_rows or any(
        row.confidence_score is None
        or row.clarity_score is None
        or row.relevance_score is None
        for row in candidate_rows
    ):
        raise HTTPException(
            status_code=409,
            detail="insufficient data: candidate responses have not been analyzed; no evaluation report was generated",
        )
    raise HTTPException(status_code=409, detail="insufficient data: report generation is not available")


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
    transcript_rows = list(
        (
            await db.scalars(
                select(Transcript).where(
                    Transcript.session_id == session_id,
                    Transcript.speaker == "candidate",
                )
            )
        ).all()
    )
    wpm_values = [row.words_per_minute for row in transcript_rows]
    if not transcript_rows or any(
        value is None for value in wpm_values
    ) or any(row.filler_words is None for row in transcript_rows):
        raise HTTPException(
            status_code=409,
            detail="insufficient data: candidate response metrics have not been analyzed",
        )
    analytics = {
        "transcript_count": len(transcript_rows),
        "avg_wpm": sum(value for value in wpm_values if value is not None) / len(transcript_rows),
        "total_filler_words": sum(row.filler_word_count for row in transcript_rows),
    }
    session = await db.get(InterviewSession, session_id)
    return {
        **analytics,
        "source": "simulated" if session and session.is_demo else "real",
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
    """
    Get all evaluation reports for the current user.
    """
    result = await db.scalars(
        select(EvaluationReport)
        .join(InterviewSession, EvaluationReport.session_id == InterviewSession.id)
        .where(
            InterviewSession.user_id == user["id"],
            InterviewSession.is_demo.is_(False),
            _analysis_is_complete(EvaluationReport.session_id),
        )
        .order_by(EvaluationReport.created_at.desc(), EvaluationReport.id.desc())
        .limit(limit)
        .offset(offset)
    )
    reports = [_parse_report_row(row) for row in result.all()]
    return {"reports": reports, "total": len(reports)}
