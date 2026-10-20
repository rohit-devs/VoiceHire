"""
Interview Session Management Endpoints
"""

import logging
import uuid
import json
import math
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.database import get_db, async_session
from app.auth import get_current_user, _verify_clerk_token, _DEMO_USER
from app.websocket_manager import connection_manager
from app.interview import InterviewOrchestrator, SessionState
from app.interview.interview_blueprint import BlueprintBuilder
from app.interview.jd_matcher import JDMatcher
from app.interview.llm_provider import (
    FakeProvider,
    GroqProvider,
    LLMUnavailable,
)
from app.interview.prompt_chaining import (
    MAX_OUTPUT_TOKENS,
    PromptChainCoordinator,
    QuestionGenerationRequest,
)
from app.interview.resume_parser import ResumeParser
from app.interview.token_budget import (
    TokenBudgetExceeded,
    reconcile_tokens,
    reserve_tokens,
)
from app.config import settings
from app.models import CandidateProfile, InterviewSession, Transcript
from app.idempotency import cached_response, store_response
from app.interview.voice_metrics import calculate_voice_metrics

logger = logging.getLogger(__name__)
router = APIRouter()

async def _verify_session_ownership(db: AsyncSession, session_id: str, user_id: str) -> None:
    """
    Verify that the given session exists and belongs to the given user.
    Raises HTTPException(404) if session not found, (403) if not owned.
    """
    session = await db.get(InterviewSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied to this session")
class InterviewSessionCreate(BaseModel):
    """Interview session creation request"""
    role: str = Field(min_length=1, max_length=100)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    candidate_profile_id: Optional[str] = None
    experience_level: Optional[str] = Field(default=None, max_length=50)
    persona: str = "technical"
    company: Optional[str] = None
    interviewer_type: Optional[str] = None
    job_description: Optional[str] = None
    resume_text: Optional[str] = None
    job_category: Optional[str] = Field(default=None, max_length=100)
    interview_type: Literal["technical", "hr", "behavioral", "mixed", "system_design"] = "mixed"
    duration_seconds: int = Field(default=1800, ge=300, le=7200)
    is_demo: bool = False


class InterviewSessionResponse(BaseModel):
    """Interview session response"""
    id: str
    role: str
    difficulty: str
    status: str
    current_state: str
    agora_channel: str
    is_demo: bool = False
    persona: str = "technical"
    interview_type: str = "mixed"
    duration_seconds: int = 1800
    company: Optional[str] = None
    experience_level: Optional[str] = None
    interview_blueprint: Optional[dict] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class TranscriptMessage(BaseModel):
    """Transcript message"""
    speaker: Literal["candidate"]
    message: str = Field(min_length=1, max_length=20_000)
    message_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    duration_ms: Optional[int] = Field(default=None, ge=1, le=300_000)
    language: Literal["en", "es", "fr"] = "en"


class GenerateQuestionRequest(BaseModel):
    candidate_transcript: Optional[str] = Field(default=None, max_length=20_000)


def _transcript_event(row: Transcript) -> dict:
    return {
        "type": "transcript",
        "message_id": row.message_id,
        "sequence_number": row.id,
        "speaker": row.speaker,
        "text": row.message,
        "timestamp_ms": row.timestamp_ms,
        "duration_ms": row.duration_ms,
        "language": row.language,
        "is_final": True,
        "source": row.source,
    }


async def _save_transcript(
    db: AsyncSession,
    *,
    session_id: str,
    speaker: Literal["candidate", "interviewer"],
    message: str,
    source: str,
    message_id: str | None = None,
    duration_ms: int | None = None,
    language: str = "en",
) -> Transcript:
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    row = Transcript(
        session_id=session_id,
        speaker=speaker,
        message=message,
        message_id=message_id or str(uuid.uuid4()),
        timestamp_ms=now_ms,
        duration_ms=duration_ms,
        language=language,
        source=source,
    )
    db.add(row)
    await db.flush()
    return row


async def _broadcast_voice_metrics(
    db: AsyncSession, session: InterviewSession
) -> None:
    candidate_rows = list(
        (
            await db.scalars(
                select(Transcript)
                .where(
                    Transcript.session_id == session.id,
                    Transcript.speaker == "candidate",
                )
                .order_by(Transcript.id)
            )
        ).all()
    )
    metrics = calculate_voice_metrics(
        [
            {
                "speaker": row.speaker,
                "message": row.message,
                "language": row.language,
                "timestamp_ms": row.timestamp_ms,
                "duration_ms": row.duration_ms,
            }
            for row in candidate_rows
        ],
        started_at=session.started_at,
        duration_seconds=session.requested_duration_seconds,
    )
    await connection_manager.broadcast_transcript(
        session_id=session.id,
        message={
            "type": "voice_metrics",
            "timestamp_ms": int(datetime.now(timezone.utc).timestamp() * 1000),
            "source": "simulated" if session.is_demo else "real",
            "metrics": metrics,
        },
    )



def _make_coordinator(is_demo: bool) -> PromptChainCoordinator | None:
    if is_demo:
        if not settings.DEMO_MODE:
            return None
        return PromptChainCoordinator(FakeProvider())
    if not settings.groq_enabled:
        return None
    return PromptChainCoordinator(
        GroqProvider(settings.GROQ_API_KEY, model=settings.GROQ_FAST_MODEL)
    )


async def _build_session_blueprint(
    db: AsyncSession, session: InterviewSession
) -> dict:
    metadata = session.metadata_json or {}
    resume_text = metadata.get("resume_text") or ""
    if not resume_text and session.candidate_profile_id:
        profile = await db.get(CandidateProfile, session.candidate_profile_id)
        if profile is None or profile.user_id != session.user_id:
            raise HTTPException(status_code=409, detail="Candidate resume profile is unavailable")
        resume_text = json.dumps(
            profile.parsed_resume_json or {"skills": profile.skills or []},
            ensure_ascii=False,
        )
    if not resume_text.strip():
        raise HTTPException(status_code=409, detail="A resume text or parsed resume profile is required")

    description = (metadata.get("job_description") or "").strip()
    category = metadata.get("job_category")
    if not description and not category:
        raise HTTPException(
            status_code=409,
            detail="A job description or job category is required before starting",
        )
    source_jd = description or f"Role category selected by candidate: {category}"

    resume_parser = ResumeParser(openai_client=None)
    jd_matcher = JDMatcher(openai_client=None)
    parsed_resume = await resume_parser.parse(resume_text)
    job_description = await jd_matcher.parse_job_description(
        source_jd, job_title=session.role, company=metadata.get("company") or ""
    )
    match = await jd_matcher.match_resume_to_jd(parsed_resume, job_description)
    blueprint = await BlueprintBuilder().build_blueprint(
        candidate_id=session.user_id,
        candidate_name=parsed_resume.full_name,
        parsed_resume=parsed_resume,
        job_id=job_description.job_id,
        target_role=session.role,
        company=metadata.get("company") or "",
        jd_match=match,
        job_description=job_description,
        difficulty={"easy": 1, "medium": 2, "hard": 3}[session.difficulty],
        duration_seconds=session.requested_duration_seconds,
        interview_type=session.interview_type,
        resume_text=resume_text,
        job_category=category,
    )
    result = blueprint.model_dump(mode="json")
    result["source_resume_available"] = bool(resume_text.strip())
    result["source_job_description_available"] = bool(description.strip())
    return result


@router.post("/sessions", response_model=InterviewSessionResponse)
async def create_interview_session(
    session_data: InterviewSessionCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Create a new interview session.

    Requires a valid Clerk JWT (or demo user in local dev).

    - `role`: Target job role (e.g., "Senior Backend Engineer")
    - `difficulty`: Interview difficulty (easy/medium/hard)
    - `candidate_profile_id`: ID of candidate profile (for personalization)
    - `persona`: AI interviewer persona (friendly/technical/hr/pressure)
    - `company`: Target company name
    - `interviewer_type`: Type of interviewer (technical/hr/behavioral/mixed)
    - `job_description` or `job_category`: Job requirements or a candidate-selected category
    - `resume_text` or `candidate_profile_id`: Candidate's real resume content

    Returns:
    - `id`: Unique session ID (UUID)
    - `agora_channel`: Agora channel name (format: vh-{sessionId})
    - `current_state`: Starting state (`created`)
    - `status`: Initial status (`created`)
    """
    try:
        if session_data.is_demo and not settings.DEMO_MODE:
            raise HTTPException(status_code=403, detail="Simulated demo sessions are disabled")
        if session_data.candidate_profile_id:
            profile = await db.get(CandidateProfile, session_data.candidate_profile_id)
            if profile is None or profile.user_id != user["id"]:
                raise HTTPException(status_code=409, detail="Candidate resume profile is unavailable")
        # Generate unique session ID
        session_id = str(uuid.uuid4())
        agora_channel = f"vh-{session_id[:8]}"  # Use first 8 chars of UUID for shorter channel name

        user_id = user["id"]
        
        # Build metadata with target interview context
        metadata = {
            "company": session_data.company,
            "experience_level": session_data.experience_level,
            "interviewer_type": session_data.interviewer_type,
            "job_description": session_data.job_description,
            "resume_text": session_data.resume_text,
            "job_category": session_data.job_category,
            "target_context": {
                "company": session_data.company,
                "experience_level": session_data.experience_level,
                "role": session_data.role,
                "interviewer_type": session_data.interviewer_type,
                "difficulty": session_data.difficulty,
                "has_jd": bool(session_data.job_description),
                "has_resume": bool(session_data.resume_text),
            }
        }
        
        # Create session in database
        session = InterviewSession(
            id=session_id,
            user_id=user_id,
            candidate_profile_id=session_data.candidate_profile_id,
            role=session_data.role,
            difficulty=session_data.difficulty,
            status=SessionState.CREATED.value,
            current_state=SessionState.CREATED.value,
            agora_channel=agora_channel,
            persona=session_data.persona,
            interview_type=session_data.interview_type,
            requested_duration_seconds=session_data.duration_seconds,
            is_demo=session_data.is_demo,
            metadata_json=metadata,
        )
        db.add(session)
        await db.commit()
        
        logger.info("Created interview session session_id=%s is_demo=%s", session_id, session_data.is_demo)
        
        return InterviewSessionResponse(
            id=session_id,
            role=session_data.role,
            difficulty=session_data.difficulty,
            status=SessionState.CREATED.value,
            current_state=SessionState.CREATED.value,
            agora_channel=agora_channel,
            is_demo=session_data.is_demo,
            persona=session_data.persona,
            interview_type=session_data.interview_type,
            duration_seconds=session_data.duration_seconds,
            company=session_data.company,
            experience_level=session_data.experience_level,
            created_at=session.created_at,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to create session: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create interview session: {str(e)}")


@router.get("/sessions", response_model=list[InterviewSessionResponse])
async def list_user_sessions(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    List all interview sessions for the current user.
    """
    try:
        result = await db.scalars(
            select(InterviewSession)
            .where(InterviewSession.user_id == user["id"])
            .order_by(InterviewSession.created_at.desc(), InterviewSession.id.desc())
            .limit(limit)
            .offset(offset)
        )
        sessions = result.all()
        return [
            InterviewSessionResponse(
                id=s.id,
                role=s.role,
                difficulty=s.difficulty,
                status=s.status,
                current_state=s.current_state,
                agora_channel=s.agora_channel,
                is_demo=s.is_demo,
                persona=s.persona,
                interview_type=s.interview_type,
                duration_seconds=s.requested_duration_seconds,
                company=(s.metadata_json or {}).get("company"),
                experience_level=(s.metadata_json or {}).get("experience_level"),
                interview_blueprint=s.interview_blueprint,
                started_at=s.started_at,
                ended_at=s.ended_at,
                created_at=s.created_at,
            )
            for s in sessions
        ]
    except Exception as e:
        logger.error(f"Failed to list sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {str(e)}")


@router.get("/sessions/{session_id}", response_model=InterviewSessionResponse)
async def get_interview_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Get interview session details.
    """
    try:
        await _verify_session_ownership(db, session_id, user["id"])

        session = await db.get(InterviewSession, session_id)
        
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        
        return InterviewSessionResponse(
            id=session.id,
            role=session.role,
            difficulty=session.difficulty,
            status=session.status,
            current_state=session.current_state,
            agora_channel=session.agora_channel,
            is_demo=session.is_demo,
            persona=session.persona,
            interview_type=session.interview_type,
            duration_seconds=session.requested_duration_seconds,
            company=(session.metadata_json or {}).get("company"),
            experience_level=(session.metadata_json or {}).get("experience_level"),
            interview_blueprint=session.interview_blueprint,
            started_at=session.started_at,
            ended_at=session.ended_at,
            created_at=session.created_at,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve session: {str(e)}")


@router.post("/sessions/{session_id}/start")
async def start_interview(
    session_id: str,
    idempotency_key: str | None = Header(
        default=None, alias="Idempotency-Key", max_length=255
    ),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Validate setup, persist the blueprint, and start once."""
    try:
        await _verify_session_ownership(db, session_id, user["id"])
        operation = f"session.start:{session_id}"
        cached = await cached_response(db, user["id"], operation, idempotency_key)
        if cached is not None:
            return cached
        session = await db.get(InterviewSession, session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        if session.current_state == SessionState.INTERVIEWING.value:
            existing_question = await db.scalar(
                select(Transcript.message)
                .where(
                    Transcript.session_id == session_id,
                    Transcript.speaker == "interviewer",
                )
                .order_by(Transcript.created_at, Transcript.id)
                .limit(1)
            )
            return {
                "status": "started",
                "session_id": session_id,
                "current_state": session.current_state,
                "question_text": existing_question,
                "is_demo": session.is_demo,
                "idempotent": True,
            }
        if session.current_state != SessionState.CREATED.value:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot start an interview in state {session.current_state}",
            )

        blueprint = session.interview_blueprint or await _build_session_blueprint(db, session)
        session.interview_blueprint = blueprint
        await db.commit()
        coordinator = _make_coordinator(session.is_demo)
        if coordinator is None:
            orchestrator = InterviewOrchestrator(session_id, db)
            await orchestrator.initialize()
            await orchestrator.transition_to(SessionState.FAILED, "llm_provider_unavailable")
            raise HTTPException(
                status_code=503,
                detail={
                    "degraded": True,
                    "state": SessionState.FAILED.value,
                    "message": "Question generation is unavailable; configure the OpenAI provider or explicitly create a simulated demo session.",
                },
            )

        orchestrator = InterviewOrchestrator(session_id, db, blueprint)
        await orchestrator.initialize()
        for target in (SessionState.READY, SessionState.CONNECTING):
            if not await orchestrator.transition_to(target, "candidate_started"):
                raise HTTPException(status_code=409, detail="Invalid session state transition")

        question_budget = min(40, max(4, session.requested_duration_seconds // 45))
        user_content = json.dumps(
            {
                "task": "Ask the opening interview question.",
                "blueprint": blueprint,
                "conversation": [],
                "current_state": SessionState.CONNECTING.value,
                "difficulty_level": {"easy": 1, "medium": 2, "hard": 3}[session.difficulty],
                "elapsed_seconds": 0,
                "question_budget": question_budget,
            },
            ensure_ascii=False,
        )
        reservation = 0
        try:
            if not session.is_demo:
                reservation = math.ceil((len(coordinator.system_prompt) + len(user_content)) / 4) + MAX_OUTPUT_TOKENS
                await reserve_tokens(
                    db,
                    user_id=user["id"],
                    session_id=session_id,
                    estimated_tokens=reservation,
                )
            generated = await coordinator.generate_next_question(
                QuestionGenerationRequest(
                    session_id=session_id,
                    current_state=SessionState.INTERVIEWING.value,
                    difficulty_level={"easy": 1, "medium": 2, "hard": 3}[session.difficulty],
                    blueprint=blueprint,
                    conversation=[],
                    elapsed_seconds=0,
                    question_budget=question_budget,
                )
            )
        except TokenBudgetExceeded as exc:
            raise HTTPException(status_code=429, detail=str(exc)) from exc
        except LLMUnavailable as exc:
            if reservation:
                await reconcile_tokens(
                    db, user_id=user["id"], session_id=session_id,
                    reserved_tokens=reservation, actual_tokens=0
                )
            await orchestrator.transition_to(SessionState.FAILED, "llm_provider_unavailable")
            raise HTTPException(
                status_code=503,
                detail={"degraded": True, "state": "failed", "message": str(exc)},
            ) from exc

        actual_tokens = generated.prompt_tokens + generated.completion_tokens
        if reservation:
            await reconcile_tokens(
                db, user_id=user["id"], session_id=session_id,
                reserved_tokens=reservation, actual_tokens=actual_tokens
            )
        if not await orchestrator.transition_to(SessionState.INTERVIEWING, "opening_question_ready"):
            raise HTTPException(status_code=409, detail="Invalid session state transition")
        session = await db.get(InterviewSession, session_id)
        source = "simulated" if session.is_demo else "real"
        transcript = await _save_transcript(
            db,
            session_id=session_id,
            speaker="interviewer",
            message=generated.question_text,
            source=source,
        )
        session.question_count += 1
        await db.commit()
        response = {
            "status": "started",
            "session_id": session_id,
            "current_state": SessionState.INTERVIEWING.value,
            "question_text": generated.question_text,
            "is_demo": session.is_demo,
            "source": source,
            "message_id": transcript.message_id,
            "sequence_number": transcript.id,
            "timestamp_ms": transcript.timestamp_ms,
        }
        await store_response(
            db, user["id"], operation, idempotency_key, session_id, response
        )
        await db.commit()
        
        await connection_manager.broadcast_transcript(
            session_id=session_id, message=_transcript_event(transcript)
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to start interview session_id=%s", session_id)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to start interview") from e


@router.post("/sessions/{session_id}/end")
async def end_interview(
    session_id: str,
    idempotency_key: str | None = Header(
        default=None, alias="Idempotency-Key", max_length=255
    ),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """End an active interview. Repeated requests are idempotent."""
    try:
        await _verify_session_ownership(db, session_id, user["id"])
        operation = f"session.end:{session_id}"
        cached = await cached_response(db, user["id"], operation, idempotency_key)
        if cached is not None:
            return cached
        session = await db.get(InterviewSession, session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Interview session not found")
        state = SessionState(session.current_state)
        if state not in {SessionState.COMPLETED, SessionState.CANCELLED, SessionState.FAILED}:
            orchestrator = InterviewOrchestrator(session_id, db, session.interview_blueprint)
            await orchestrator.initialize()
            target = (
                SessionState.CANCELLED
                if state in {SessionState.CREATED, SessionState.READY}
                else SessionState.COMPLETED
            )
            if not await orchestrator.transition_to(target, "candidate_ended"):
                raise HTTPException(status_code=409, detail=f"Cannot end a session in state {state.value}")
        response = {
            "status": "ended",
            "session_id": session_id,
            "current_state": target.value if state not in {SessionState.COMPLETED, SessionState.CANCELLED, SessionState.FAILED} else state.value,
            "is_demo": session.is_demo,
        }
        await store_response(
            db, user["id"], operation, idempotency_key, session_id, response
        )
        await db.commit()
        return response

    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        logger.exception("Failed to end interview session_id=%s", session_id)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to end interview") from e


@router.post("/sessions/{session_id}/transcript")
async def add_transcript(
    session_id: str,
    message: TranscriptMessage,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Add a transcript message (called in real-time as speech is captured).

    If speaker is 'candidate', triggers response analysis and orchestrator update.
    Broadcasts transcript via WebSocket to connected clients.

    Returns:
    - `status`: "recorded" on success
    - `session_id`: Echo of session ID
    """
    try:
        await _verify_session_ownership(db, session_id, user["id"])
        session = await db.get(InterviewSession, session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Interview session not found")
        existing = await db.scalar(
            select(Transcript).where(Transcript.message_id == str(message.message_id))
        )
        if existing is not None:
            if (
                existing.session_id != session_id
                or existing.speaker != message.speaker
                or existing.message != message.message
                or existing.duration_ms != message.duration_ms
                or existing.language != message.language
            ):
                raise HTTPException(status_code=409, detail="Transcript message id was already used")
            return {
                "status": "recorded",
                "session_id": session_id,
                "current_state": session.current_state,
                "source": existing.source,
                "message_id": existing.message_id,
                "sequence_number": existing.id,
                "timestamp_ms": existing.timestamp_ms,
                "idempotent": True,
            }
        source_state = SessionState(session.current_state)
        if source_state != SessionState.INTERVIEWING:
            raise HTTPException(
                status_code=409,
                detail=f"Transcript is not accepted while session is {source_state.value}",
            )
        orchestrator = InterviewOrchestrator(session_id, db, session.interview_blueprint)
        await orchestrator.initialize()
        if message.speaker == "candidate" and not await orchestrator.transition_to(
            SessionState.PROCESSING_RESPONSE, "candidate_answer_received"
        ):
            raise HTTPException(status_code=409, detail="Invalid session state transition")
        source = "simulated" if session.is_demo else "real"
        transcript = await _save_transcript(
            db,
            session_id=session_id,
            speaker=message.speaker,
            message=message.message,
            source=source,
            message_id=str(message.message_id),
            duration_ms=message.duration_ms,
            language=message.language,
        )
        await db.commit()
        await connection_manager.broadcast_transcript(
            session_id=session_id, message=_transcript_event(transcript)
        )
        if message.speaker == "candidate":
            await _broadcast_voice_metrics(db, session)

        return {
            "status": "recorded",
            "session_id": session_id,
            "current_state": (
                SessionState.PROCESSING_RESPONSE.value
                if message.speaker == "candidate"
                else SessionState.INTERVIEWING.value
            ),
            "source": source,
            "message_id": transcript.message_id,
            "sequence_number": transcript.id,
            "timestamp_ms": transcript.timestamp_ms,
        }

    except IntegrityError:
        await db.rollback()
        existing = await db.scalar(
            select(Transcript).where(Transcript.message_id == str(message.message_id))
        )
        if (
            existing is not None
            and existing.session_id == session_id
            and existing.speaker == message.speaker
            and existing.message == message.message
            and existing.duration_ms == message.duration_ms
            and existing.language == message.language
        ):
            return {
                "status": "recorded",
                "session_id": session_id,
                "current_state": SessionState.PROCESSING_RESPONSE.value,
                "source": existing.source,
                "message_id": existing.message_id,
                "sequence_number": existing.id,
                "timestamp_ms": existing.timestamp_ms,
                "idempotent": True,
            }
        raise HTTPException(status_code=409, detail="Transcript could not be persisted exactly once")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to record transcript session_id=%s", session_id)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to record transcript") from e


@router.get("/sessions/{session_id}/transcript")
async def get_session_transcript(
    session_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    await _verify_session_ownership(db, session_id, user["id"])
    rows = await db.scalars(
        select(Transcript)
        .where(Transcript.session_id == session_id)
        .order_by(Transcript.id.asc())
        .limit(limit)
        .offset(offset)
    )
    return [
        {
            "message_id": row.message_id,
            "sequence_number": row.id,
            "speaker": row.speaker,
            "text": row.message,
            "timestamp_ms": row.timestamp_ms,
            "source": row.source,
        }
        for row in rows
    ]


@router.get("/sessions/{session_id}/state")
async def get_session_state(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Get current session state (for frontend polling or SSE).
    Returns state machine state and metrics.
    """
    try:
        await _verify_session_ownership(db, session_id, user["id"])
        session = await db.get(InterviewSession, session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        return {
            "current_state": session.current_state,
            "status": session.status,
            "question_count": session.question_count,
            "state_updated_at": session.state_updated_at,
            "state_history": session.state_history,
            "is_demo": session.is_demo,
            "session_id": session_id,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get session state: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve session state: {str(e)}")


@router.websocket("/sessions/{session_id}/ws")
async def websocket_endpoint(
    session_id: str,
    websocket: WebSocket,
    token: Optional[str] = None,
    after_sequence: int = 0,
):
    """Authenticate against session ownership, then replay and stream final segments."""
    if after_sequence < 0:
        await websocket.close(code=1008)
        return
    db = async_session()
    try:
        session = await db.get(InterviewSession, session_id)
        if session is None:
            await websocket.close(code=1008)
            return
        if token:
            try:
                user_info = await _verify_clerk_token(token)
            except HTTPException:
                await websocket.close(code=1008)
                return
            user_id = user_info["id"]
        elif settings.DEMO_MODE and session.is_demo:
            user_id = _DEMO_USER["id"]
        else:
            await websocket.close(code=1008)
            return
        if session.user_id != user_id:
            await websocket.close(code=1008)
            return
        replay_rows = list(
            (
                await db.scalars(
                    select(Transcript)
                    .where(
                        Transcript.session_id == session_id,
                        Transcript.id > after_sequence,
                    )
                    .order_by(Transcript.id)
                )
            ).all()
        )
        replay_events = [_transcript_event(row) for row in replay_rows]
    finally:
        await db.close()

    await connection_manager.connect(session_id, websocket)
    try:
        for event in replay_events:
            await websocket.send_json(event)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect(session_id, websocket)
    except (RuntimeError, OSError):
        connection_manager.disconnect(session_id, websocket)


@router.post("/sessions/{session_id}/generate-question")
async def generate_next_question(
    session_id: str,
    request: GenerateQuestionRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Generate one unique next question from the persisted conversation."""
    try:
        await _verify_session_ownership(db, session_id, user["id"])
        session = await db.get(InterviewSession, session_id)
        if session is None:
            raise HTTPException(status_code=404, detail="Interview session not found")
        if session.current_state != SessionState.PROCESSING_RESPONSE.value:
            raise HTTPException(
                status_code=409,
                detail=f"Question generation is invalid while session is {session.current_state}",
            )
        transcript_rows = list(
            (
                await db.scalars(
                    select(Transcript)
                    .where(Transcript.session_id == session_id)
                    .order_by(Transcript.created_at, Transcript.id)
                )
            ).all()
        )
        if not transcript_rows or transcript_rows[-1].speaker != "candidate":
            raise HTTPException(status_code=409, detail="A persisted candidate answer is required")
        if request.candidate_transcript and request.candidate_transcript != transcript_rows[-1].message:
            raise HTTPException(status_code=409, detail="Submitted answer does not match the saved transcript")

        coordinator = _make_coordinator(session.is_demo)
        if coordinator is None:
            raise HTTPException(
                status_code=503,
                detail={
                    "degraded": True,
                    "state": "failed",
                    "message": "Question generation is unavailable; configure the OpenAI provider.",
                },
            )
        blueprint = session.interview_blueprint
        if not blueprint:
            raise HTTPException(status_code=409, detail="Interview blueprint is missing")
        start = session.started_at
        if start is not None and start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        elapsed = max(0, int((datetime.now(timezone.utc) - start).total_seconds())) if start else 0
        question_budget = min(40, max(4, session.requested_duration_seconds // 45))
        if elapsed >= session.requested_duration_seconds or session.question_count >= question_budget:
            orchestrator = InterviewOrchestrator(session_id, db, blueprint)
            await orchestrator.initialize()
            if not await orchestrator.transition_to(
                SessionState.COMPLETED, "interview_budget_exhausted"
            ):
                raise HTTPException(status_code=409, detail="Invalid session state transition")
            closing_text = "Thank you for your time. The interview is now complete."
            source = "simulated" if session.is_demo else "real"
            timestamp_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
            transcript = await _save_transcript(
                db,
                session_id=session_id,
                speaker="interviewer",
                message=closing_text,
                source=source,
            )
            await db.commit()
            await connection_manager.broadcast_transcript(
                session_id=session_id, message=_transcript_event(transcript)
            )
            return {
                "question_text": closing_text,
                "state": SessionState.COMPLETED.value,
                "difficulty_level": {"easy": 1, "medium": 2, "hard": 3}[session.difficulty],
                "reasoning": "The interview duration or question budget was reached.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source": source,
                "is_demo": session.is_demo,
                "degraded": False,
                "message_id": transcript.message_id,
                "sequence_number": transcript.id,
                "timestamp_ms": transcript.timestamp_ms,
            }
        if session.question_count >= question_budget - 1:
            question_text = "Thank you for sharing your experience. Do you have any final questions for me?"
            generated_question = None
        else:
            generation_request = QuestionGenerationRequest(
                session_id=session_id,
                current_state=SessionState.PROCESSING_RESPONSE.value,
                difficulty_level={"easy": 1, "medium": 2, "hard": 3}[session.difficulty],
                blueprint=blueprint,
                conversation=[
                    {"speaker": row.speaker, "text": row.message}
                    for row in transcript_rows
                ],
                elapsed_seconds=elapsed,
                question_budget=question_budget,
            )
            user_content = json.dumps(
                generation_request.model_dump(mode="json"), ensure_ascii=False
            )
            reservation = 0
            if not session.is_demo:
                reservation = math.ceil(
                    (len(coordinator.system_prompt) + len(user_content)) / 4
                ) + MAX_OUTPUT_TOKENS
                await reserve_tokens(
                    db,
                    user_id=user["id"],
                    session_id=session_id,
                    estimated_tokens=reservation,
                )
            try:
                generated_question = await coordinator.generate_next_question(generation_request)
            except LLMUnavailable as exc:
                if reservation:
                    await reconcile_tokens(
                        db, user_id=user["id"], session_id=session_id,
                        reserved_tokens=reservation, actual_tokens=0
                    )
                raise HTTPException(
                    status_code=503,
                    detail={"degraded": True, "state": "processing_response", "message": str(exc)},
                ) from exc
            except TokenBudgetExceeded as exc:
                raise HTTPException(status_code=429, detail=str(exc)) from exc
            question_text = generated_question.question_text
            if reservation:
                await reconcile_tokens(
                    db,
                    user_id=user["id"],
                    session_id=session_id,
                    reserved_tokens=reservation,
                    actual_tokens=generated_question.prompt_tokens
                    + generated_question.completion_tokens,
                )

        source = "simulated" if session.is_demo else "real"
        orchestrator = InterviewOrchestrator(session_id, db, blueprint)
        await orchestrator.initialize()
        if not await orchestrator.transition_to(SessionState.INTERVIEWING, "next_question_ready"):
            raise HTTPException(status_code=409, detail="Invalid session state transition")
        transcript = await _save_transcript(
            db,
            session_id=session_id,
            speaker="interviewer",
            message=question_text,
            source=source,
        )
        session.question_count += 1
        await db.commit()
        await connection_manager.broadcast_transcript(
            session_id=session_id,
            message={
                **_transcript_event(transcript),
                "state": SessionState.INTERVIEWING.value,
                "difficulty": {"easy": 1, "medium": 2, "hard": 3}[session.difficulty],
            }
        )
        
        return {
            "question_text": question_text,
            "state": SessionState.INTERVIEWING.value,
            "difficulty_level": {"easy": 1, "medium": 2, "hard": 3}[session.difficulty],
            "reasoning": (
                generated_question.reasoning if generated_question else "Interview time or question budget reached."
            ),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": source,
            "is_demo": session.is_demo,
            "degraded": False,
            "message_id": transcript.message_id,
            "sequence_number": transcript.id,
            "timestamp_ms": transcript.timestamp_ms,
        }
        
    except TokenBudgetExceeded as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to generate question session_id=%s", session_id)
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to generate question") from e
