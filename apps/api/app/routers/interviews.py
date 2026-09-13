"""
Interview Session Management Endpoints
"""

import json
import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from typing import Optional
from datetime import datetime
from app.database import get_db, async_session
from app.auth import get_current_user, get_current_user_id, _verify_clerk_token, _DEMO_USER
from app.websocket_manager import connection_manager
from app.demo_manager import demo_manager
from app.interview import InterviewOrchestrator, SessionState, ResponseAnalyzer, ResponseAnalysis
from app.interview.prompt_chaining import PromptChainCoordinator, QuestionGenerationRequest
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Global registry of orchestrators per session
orchestrators: dict[str, InterviewOrchestrator] = {}


async def _verify_session_ownership(db: AsyncSession, session_id: str, user_id: str) -> None:
    """
    Verify that the given session exists and belongs to the given user.
    Raises HTTPException(404) if session not found, (403) if not owned.
    """
    result = await db.execute(
        text("SELECT user_id FROM interview_sessions WHERE id = :id"),
        {"id": session_id}
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    if row.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied to this session")
analyzer: Optional[ResponseAnalyzer] = None
prompt_chain_coordinator: Optional[PromptChainCoordinator] = None

def get_analyzer() -> ResponseAnalyzer:
    """Get or create ResponseAnalyzer singleton"""
    global analyzer
    if analyzer is None and settings.OPENAI_API_KEY:
        analyzer = ResponseAnalyzer(openai_api_key=settings.OPENAI_API_KEY)
    return analyzer


def get_prompt_chain_coordinator() -> PromptChainCoordinator:
    """Get or create PromptChainCoordinator singleton"""
    global prompt_chain_coordinator
    if prompt_chain_coordinator is None:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        prompt_chain_coordinator = PromptChainCoordinator(openai_client=client)
    return prompt_chain_coordinator


class InterviewSessionCreate(BaseModel):
    """Interview session creation request"""
    role: str
    difficulty: str = "medium"
    candidate_profile_id: Optional[str] = None
    persona: str = "technical"
    company: Optional[str] = None
    interviewer_type: Optional[str] = None
    job_description: Optional[str] = None
    resume_text: Optional[str] = None


class InterviewSessionResponse(BaseModel):
    """Interview session response"""
    id: str
    role: str
    difficulty: str
    status: str
    current_state: str
    agora_channel: str
    
    class Config:
        from_attributes = True


class TranscriptMessage(BaseModel):
    """Transcript message"""
    speaker: str  # 'candidate' or 'interviewer'
    message: str
    timestamp_ms: Optional[int] = None


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
    - `job_description`: Optional job description text
    - `resume_text`: Optional resume text for context

    Returns:
    - `id`: Unique session ID (UUID)
    - `agora_channel`: Agora channel name (format: vh-{sessionId})
    - `current_state`: Starting state (intro)
    - `status`: Initial status (scheduled)
    """
    try:
        # Generate unique session ID
        session_id = str(uuid.uuid4())
        agora_channel = f"vh-{session_id[:8]}"  # Use first 8 chars of UUID for shorter channel name

        user_id = user["id"]
        
        # Build metadata with target interview context
        metadata = {
            "company": session_data.company,
            "interviewer_type": session_data.interviewer_type,
            "job_description": session_data.job_description,
            "resume_text": session_data.resume_text,
            "target_context": {
                "company": session_data.company,
                "role": session_data.role,
                "interviewer_type": session_data.interviewer_type,
                "difficulty": session_data.difficulty,
                "has_jd": bool(session_data.job_description),
                "has_resume": bool(session_data.resume_text),
            }
        }
        
        # Create session in database
        await db.execute(
            text(
                """
                INSERT INTO interview_sessions (id, user_id, role, difficulty, status, current_state, agora_channel, persona, metadata)
                VALUES (:id, :user_id, :role, :difficulty, :status, :current_state, :agora_channel, :persona, :metadata)
                """
            ),
            {
                "id": session_id,
                "user_id": user_id,
                "role": session_data.role,
                "difficulty": session_data.difficulty,
                "status": "scheduled",
                "current_state": "intro",
                "agora_channel": agora_channel,
                "persona": session_data.persona,
                "metadata": json.dumps(metadata),
            }
        )
        await db.commit()
        
        logger.info(f"✅ Created session {session_id} for role: {session_data.role}")
        
        return InterviewSessionResponse(
            id=session_id,
            role=session_data.role,
            difficulty=session_data.difficulty,
            status="scheduled",
            current_state="intro",
            agora_channel=agora_channel
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to create session: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create interview session: {str(e)}")


@router.get("/sessions", response_model=list[InterviewSessionResponse])
async def list_user_sessions(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    List all interview sessions for the current user.
    """
    try:
        result = await db.execute(
            text(
                "SELECT id, role, difficulty, status, current_state, agora_channel "
                "FROM interview_sessions WHERE user_id = :user_id ORDER BY created_at DESC"
            ),
            {"user_id": user["id"]},
        )
        sessions = result.all()
        return [
            InterviewSessionResponse(
                id=s.id,
                role=s.role,
                difficulty=s.difficulty,
                status=s.status,
                current_state=s.current_state,
                agora_channel=s.agora_channel
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

        result = await db.execute(
            text("SELECT id, role, difficulty, status, current_state, agora_channel FROM interview_sessions WHERE id = :id"),
            {"id": session_id}
        )
        session = result.first()
        
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        
        return InterviewSessionResponse(
            id=session.id,
            role=session.role,
            difficulty=session.difficulty,
            status=session.status,
            current_state=session.current_state,
            agora_channel=session.agora_channel
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve session: {str(e)}")


@router.post("/sessions/{session_id}/start")
async def start_interview(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Start the interview (transition from 'scheduled' to 'active').
    Initializes the interview orchestrator and readies AI agent.

    Returns:
    - `status`: "started" on success
    - `session_id`: Echo of session ID
    - `current_state`: Current interview state (should be "intro")
    """
    try:
        await _verify_session_ownership(db, session_id, user["id"])
        # Verify session exists and is in 'scheduled' state
        result = await db.execute(
            text("SELECT id, status, current_state FROM interview_sessions WHERE id = :id"),
            {"id": session_id}
        )
        session = result.first()
        
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        
        if session.status != "scheduled":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot start interview: current status is {session.status}"
            )
        
        # Get prompt chain coordinator
        coordinator = get_prompt_chain_coordinator()
        
        # Initialize orchestrator for this session
        orchestrator = InterviewOrchestrator(session_id, db, blueprint=None, prompt_coordinator=coordinator)
        await orchestrator.initialize(initial_state=SessionState.INTRO)
        orchestrators[session_id] = orchestrator
        
        # Update session status to 'active'
        await db.execute(
            text("UPDATE interview_sessions SET status = :status WHERE id = :id"),
            {"status": "active", "id": session_id}
        )
        await db.commit()
        
        # Broadcast state change via WebSocket
        await connection_manager.broadcast_state_change(
            session_id=session_id,
            state="intro",
            metadata={
                "event": "interview_started",
                "timestamp_ms": int(datetime.utcnow().timestamp() * 1000)
            }
        )
        
        logger.info(f"✅ Interview started for session {session_id}")
        
        return {
            "status": "started",
            "session_id": session_id,
            "current_state": "intro"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to start interview {session_id}: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to start interview: {str(e)}")


@router.post("/sessions/{session_id}/end")
async def end_interview(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    End the interview (transition to 'completed').
    Triggers evaluation report generation.

    Returns:
    - `status`: "ended" on success
    - `session_id`: Echo of session ID
    """
    try:
        await _verify_session_ownership(db, session_id, user["id"])
        # Get orchestrator for this session
        orchestrator = orchestrators.get(session_id)
        if orchestrator:
            await orchestrator.end_interview(reason="user_requested")
        
        # Update session status to 'completed'
        await db.execute(
            text("UPDATE interview_sessions SET status = :status WHERE id = :id"),
            {"status": "completed", "id": session_id}
        )
        await db.commit()
        
        # Cleanup orchestrator
        if session_id in orchestrators:
            del orchestrators[session_id]
        
        logger.info(f"✅ Interview ended for session {session_id}")
        
        return {
            "status": "ended",
            "session_id": session_id
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to end interview {session_id}: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to end interview: {str(e)}")


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
        timestamp_ms = message.timestamp_ms or int(datetime.utcnow().timestamp() * 1000)
        
        # Record transcript in database
        await db.execute(
            text(
                """
                INSERT INTO transcripts (session_id, speaker, message, timestamp_ms)
                VALUES (:session_id, :speaker, :message, :timestamp_ms)
                """
            ),
            {
                "session_id": session_id,
                "speaker": message.speaker,
                "message": message.message,
                "timestamp_ms": timestamp_ms
            }
        )
        await db.commit()
        
        # Broadcast transcript via WebSocket
        await connection_manager.broadcast_transcript(
            session_id=session_id,
            message={
                "type": "transcript",
                "speaker": message.speaker,
                "text": message.message,
                "timestamp_ms": timestamp_ms
            }
        )
        
        logger.info(f"📝 Transcript recorded for session {session_id}: {message.speaker} spoke {len(message.message.split())} words")
        
        # If candidate response, trigger analysis
        if message.speaker == "candidate":
            try:
                analyzer_instance = get_analyzer()
                if analyzer_instance:
                    # Get orchestrator context
                    orchestrator = orchestrators.get(session_id)
                    current_state = orchestrator.get_current_state().value if orchestrator else "unknown"
                    
                    # Analyze response
                    analysis = await analyzer_instance.analyze(
                        candidate_response=message.message,
                        question_asked="",  # TODO: Get from context
                        current_state=current_state,
                        candidate_profile=None  # TODO: Load from DB
                    )
                    
                    # Update orchestrator with analysis results
                    if orchestrator:
                        await orchestrator.handle_analyzer_output(
                            technical_score=analysis.technical_score,
                            relevance_score=analysis.relevance_score,
                            clarity_score=analysis.clarity_score,
                            confidence_score=analysis.confidence_score,
                            recommended_action=analysis.recommended_action,
                            difficulty_adjustment=analysis.difficulty_adjustment,
                            state_transition=analysis.state_transition,
                            candidate_transcript=message.message
                        )
                    
                    # Broadcast analysis results
                    await connection_manager.broadcast_metrics(
                        session_id=session_id,
                        clarity_score=analysis.clarity_score,
                        confidence_score=analysis.confidence_score,
                        technical_score=analysis.technical_score,
                        relevance_score=analysis.relevance_score,
                        filler_words_count=len(analysis.filler_words_detected),
                        filler_words=analysis.filler_words_detected,
                        timestamp_ms=timestamp_ms
                    )
                    
            except Exception as e:
                logger.warning(f"⚠️  Failed to analyze response: {e}")
        
        return {
            "status": "recorded",
            "session_id": session_id
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to record transcript: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record transcript: {str(e)}")


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
        # Try to get from orchestrator first (if session is active)
        orchestrator = orchestrators.get(session_id)
        if orchestrator:
            return {
                "current_state": orchestrator.get_current_state().value if orchestrator.get_current_state() else "unknown",
                "difficulty_level": orchestrator.get_difficulty_level(),
                "question_count": orchestrator.get_question_count(),
                "session_id": session_id
            }
        
        # Fall back to database
        result = await db.execute(
            text("SELECT current_state FROM interview_sessions WHERE id = :id"),
            {"id": session_id}
        )
        session = result.first()
        
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        
        return {
            "current_state": session.current_state,
            "session_id": session_id
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
):
    """
    WebSocket endpoint for real-time transcript streaming and metrics updates.

    Connection flow:
    1. Client connects: ws://localhost:8000/api/interviews/sessions/{session_id}/ws?token=<jwt>
    2. Receives transcript messages as they're captured
    3. Receives real-time metrics updates
    4. Receives state changes
    5. Receives AI thinking status

    Message types:
    - `transcript`: {type, speaker, text, timestamp_ms, metrics}
    - `metrics`: {type, clarity_score, confidence_score, ...}
    - `state_change`: {type, state, metadata}
    - `ai_thinking`: {type, text}
    - `evaluation_complete`: {type, report}

    Demo Mode:
    For testing purposes, connecting to "demo-*" sessions will auto-start
    a simulated interview with realistic transcript and metrics data.
    """
    # ── Authenticate via query param token ──
    if not settings.DEMO_MODE or token:
        if not token:
            await websocket.close(code=1008)
            return
        try:
            user_info = await _verify_clerk_token(token)
            user_id = user_info["id"]
            # If not demo mode, verify session ownership
            if not settings.DEMO_MODE:
                db = async_session()
                try:
                    await _verify_session_ownership(db, session_id, user_id)
                finally:
                    await db.close()
        except HTTPException:
            if not settings.DEMO_MODE:
                await websocket.close(code=1008)
                return
            user_info = _DEMO_USER.copy()
            user_id = user_info["id"]
    else:
        user_info = _DEMO_USER.copy()
        user_id = user_info["id"]

    await connection_manager.connect(session_id, websocket)
    logger.info(f"🔗 Client connected to session {session_id}")
    
    # Start demo interview if session ID matches demo pattern
    if session_id.startswith("demo-"):
        logger.info(f"🎬 Starting demo interview for session {session_id}")
        await demo_manager.start_demo_interview(session_id, duration_seconds=60)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect(session_id, websocket)
        if session_id.startswith("demo-"):
            await demo_manager.stop_demo_interview(session_id)
    except Exception:
        connection_manager.disconnect(session_id, websocket)


@router.post("/sessions/{session_id}/generate-question")
async def generate_next_question(
    session_id: str,
    candidate_transcript: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Phase 3C: Prompt Chaining - Generate next interview question.
    
    This endpoint is the culmination of the prompt chaining pipeline:
    1. Candidate response is analyzed (ResponseAnalyzer)
    2. Orchestrator updates state and difficulty based on analysis
    3. This endpoint generates the next question using updated context
    4. Question is ready for TTS conversion
    
    Args:
    - `session_id`: Interview session ID
    - `candidate_transcript`: Full text of candidate's last response
    
    Returns:
    - `question_text`: Next question to ask
    - `state`: Current interview state
    - `difficulty_level`: Current difficulty level (1-3)
    - `reasoning`: Why this question was chosen
    - `timestamp`: When question was generated
    """
    try:
        await _verify_session_ownership(db, session_id, user["id"])

        # Get orchestrator for this session
        orchestrator = orchestrators.get(session_id)
        if not orchestrator:
            raise HTTPException(
                status_code=404,
                detail=f"Interview session {session_id} not found or not initialized"
            )
        
        # Get prompt chain coordinator
        coordinator = get_prompt_chain_coordinator()
        
        # Build generation request with orchestrator context
        request = QuestionGenerationRequest(
            session_id=session_id,
            current_state=orchestrator.current_state,
            difficulty_level=orchestrator.difficulty_level,
            candidate_transcript=candidate_transcript,
            candidate_name=getattr(orchestrator, 'candidate_name', None),
            target_role=getattr(orchestrator, 'target_role', None),
            priority_competencies=getattr(orchestrator, 'priority_competencies', None),
            resume_claims=getattr(orchestrator, 'resume_claims', None),
            previous_weaknesses=getattr(orchestrator, 'previous_weaknesses', None),
            experience_level=getattr(orchestrator, 'experience_level', None),
            analyzer_feedback=None  # Will be injected by coordinator if needed
        )
        
        # Generate next question using prompt chaining
        generated_question = await coordinator.generate_next_question(request)
        
        # Broadcast the generated question (so frontend can show it)
        await connection_manager.broadcast_transcript(
            session_id=session_id,
            message={
                "type": "ai_question_generated",
                "text": generated_question.question_text,
                "state": generated_question.state,
                "difficulty": generated_question.difficulty_level,
                "timestamp_ms": int(generated_question.timestamp.timestamp() * 1000)
            }
        )
        
        logger.info(f"✅ Generated next question for session {session_id}")
        
        return {
            "question_text": generated_question.question_text,
            "state": generated_question.state,
            "difficulty_level": generated_question.difficulty_level,
            "reasoning": generated_question.reasoning,
            "timestamp": generated_question.timestamp.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to generate question for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate question: {str(e)}")

