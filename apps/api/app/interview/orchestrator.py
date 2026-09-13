"""
Interview Orchestrator & State Machine
Manages the interview flow and state transitions.
"""

import logging
import json
from enum import Enum
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class SessionState(str, Enum):
    """Interview session state machine states"""
    INTRO = "intro"           # Initial greeting and role introduction
    WARMUP = "warmup"         # Ice-breaker questions to establish rapport
    TECHNICAL = "technical"   # Core technical/domain questions
    BEHAVIORAL = "behavioral" # Soft skills and problem-solving scenarios
    PRESSURE = "pressure"     # Challenging edge cases and high-pressure scenarios
    CLOSING = "closing"       # Summary and final thoughts
    COMPLETED = "completed"   # Interview finished, awaiting evaluation
    ERROR = "error"           # Error state


class StateMetadata(BaseModel):
    """Metadata associated with a state transition"""
    previous_state: Optional[SessionState] = None
    transition_reason: Optional[str] = None
    timestamp_ms: int
    metrics: Optional[Dict[str, Any]] = None


class InterviewOrchestrator:
    """
    Orchestrates interview flow and manages state machine transitions.
    
    State Transition Rules:
    - INTRO → WARMUP: After initial greeting
    - WARMUP → TECHNICAL: Candidate demonstrates comfort level
    - TECHNICAL → BEHAVIORAL: Good technical performance OR weak areas need soft skills eval
    - TECHNICAL → PRESSURE: Strong technical performance → challenge harder questions
    - BEHAVIORAL → PRESSURE: Weak behavioral responses → pressure scenarios
    - BEHAVIORAL → CLOSING: Strong overall performance
    - PRESSURE → CLOSING: End of pressure phase
    - ANY → COMPLETED: Interview time limit reached or candidate ends session
    - ANY → ERROR: Critical error encountered
    
    Transitions triggered by:
    1. Response Analyzer output (scores, recommended_action)
    2. Time-based progression (if no analyzer result after timeout)
    3. Candidate interruption (VAD event)
    4. User action (end interview)
    """

    # State transition rules: source_state -> [(target_state, condition)]
    TRANSITION_RULES: Dict[SessionState, list] = {
        SessionState.INTRO: [SessionState.WARMUP],
        SessionState.WARMUP: [SessionState.TECHNICAL],
        SessionState.TECHNICAL: [
            SessionState.BEHAVIORAL,  # Normal progression
            SessionState.PRESSURE,    # If strong (difficulty_adjustment=UP)
        ],
        SessionState.BEHAVIORAL: [
            SessionState.PRESSURE,    # If weak (difficulty_adjustment=DOWN)
            SessionState.CLOSING,     # If strong or time remaining < 1 min
        ],
        SessionState.PRESSURE: [SessionState.CLOSING],
        SessionState.CLOSING: [SessionState.COMPLETED],
    }

    def __init__(self, session_id: str, db: AsyncSession, blueprint: Optional[Dict[str, Any]] = None, prompt_coordinator: Optional[Any] = None):
        """
        Initialize orchestrator for a session.
        
        Args:
            session_id: Interview session ID
            db: AsyncSession for database operations
            blueprint: Optional interview blueprint with personalization context
            prompt_coordinator: Optional PromptChainCoordinator for adaptive question generation
        """
        self.session_id = session_id
        self.db = db
        self.current_state: Optional[SessionState] = None
        self.state_history: list[StateMetadata] = []
        self.start_time_ms: Optional[int] = None
        self.duration_ms: int = 0
        self.question_count: int = 0
        self.difficulty_level: int = 1  # 1=easy, 2=medium, 3=hard
        self.candidate_name: str = "Candidate"
        self.target_role: str = "the role"
        self.priority_competencies: list[str] = []
        self.resume_claims: list[str] = []
        self.previous_weaknesses: list[str] = []
        self.experience_level: str = "experienced"
        self.blueprint = blueprint
        self.prompt_coordinator = prompt_coordinator
        self.last_candidate_transcript: str = ""
        self.last_analyzer_feedback: Optional[Dict[str, Any]] = None

    async def initialize(self, initial_state: SessionState = SessionState.INTRO, blueprint: Optional[Dict[str, Any]] = None) -> None:
        """
        Initialize orchestrator with session data from database.
        
        Args:
            initial_state: State to start with (default: INTRO)
            blueprint: Optional interview blueprint with personalization context
        """
        try:
            # Verify session exists
            result = await self.db.execute(
                text("SELECT id, current_state, difficulty, metadata FROM interview_sessions WHERE id = :id"),
                {"id": self.session_id}
            )
            session = result.first()
            
            if not session:
                logger.warning(f"Session {self.session_id} not found, starting with {initial_state}")
                self.current_state = initial_state
            else:
                self.current_state = SessionState(session.current_state or initial_state.value)
                self.difficulty_level = {"easy": 1, "medium": 2, "hard": 3}.get(session.difficulty, 2)
                
                # Extract blueprint context from session metadata if available
                if session.metadata:
                    try:
                        metadata = json.loads(session.metadata) if isinstance(session.metadata, str) else session.metadata
                        target_context = metadata.get("target_context", {})
                        self.candidate_name = target_context.get("candidate_name", "Candidate")
                        self.target_role = target_context.get("target_role", session.role)
                        self.experience_level = target_context.get("experience_level", "experienced")
                    except (json.JSONDecodeError, AttributeError):
                        pass
            
            # Override with explicit blueprint if provided
            if blueprint:
                self.candidate_name = blueprint.get("candidate_name", self.candidate_name)
                self.target_role = blueprint.get("target_role", self.target_role)
                self.priority_competencies = blueprint.get("interview_focus_areas", [])
                self.previous_weaknesses = blueprint.get("skill_gaps", [])
                self.experience_level = blueprint.get("experience_level", self.experience_level)
            
            self.start_time_ms = int(datetime.utcnow().timestamp() * 1000)
            logger.info(f"✅ Orchestrator initialized for session {self.session_id}, state: {self.current_state}")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize orchestrator: {e}")
            self.current_state = initial_state

    async def transition_to(
        self,
        target_state: SessionState,
        reason: str = "automatic",
        metrics: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Attempt to transition to a target state.
        
        Validates against state machine rules. If valid, updates database
        and broadcasts state change via WebSocket.
        
        Args:
            target_state: Target SessionState
            reason: Human-readable reason for transition
            metrics: Optional performance metrics at time of transition
        
        Returns:
            True if transition succeeded, False otherwise
        """
        if self.current_state is None:
            logger.error("❌ Cannot transition: orchestrator not initialized")
            return False

        # Validate transition is allowed
        allowed_transitions = self.TRANSITION_RULES.get(self.current_state, [])
        if target_state not in allowed_transitions:
            logger.warning(
                f"❌ Disallowed transition: {self.current_state} → {target_state}. "
                f"Allowed: {allowed_transitions}"
            )
            return False

        previous_state = self.current_state
        self.current_state = target_state
        self.question_count += 1

        # Record state metadata
        metadata = StateMetadata(
            previous_state=previous_state,
            transition_reason=reason,
            timestamp_ms=int(datetime.utcnow().timestamp() * 1000),
            metrics=metrics or {}
        )
        self.state_history.append(metadata)

        # Update database
        try:
            await self.db.execute(
                text("UPDATE interview_sessions SET current_state = :state WHERE id = :id"),
                {"state": target_state.value, "id": self.session_id},
            )
            await self.db.commit()
            logger.info(
                f"✅ State transition: {previous_state} → {target_state} "
                f"(reason: {reason}, Q#{self.question_count})"
            )
        except Exception as e:
            logger.error(f"❌ Failed to update state in database: {e}")
            await self.db.rollback()
            return False

        # Broadcast state change via WebSocket
        try:
            from app.websocket_manager import connection_manager
            await connection_manager.broadcast_state_change(
                session_id=self.session_id,
                state=target_state.value,
                metadata={
                    "previous_state": previous_state.value,
                    "reason": reason,
                    "question_count": self.question_count,
                    "metrics": metadata.metrics
                }
            )
        except Exception as e:
            logger.warning(f"⚠️  Failed to broadcast state change: {e}")

        return True

    async def handle_analyzer_output(
        self,
        technical_score: int,
        relevance_score: int,
        clarity_score: int,
        confidence_score: int,
        recommended_action: str,
        difficulty_adjustment: str = "NONE",
        state_transition: Optional[str] = None,
        candidate_transcript: Optional[str] = None
    ) -> bool:
        """
        Process Response Analyzer output and trigger state transitions.
        
        The analyzer provides:
        - Scores (0-100): technical, relevance, clarity, confidence
        - recommended_action: CHALLENGE, CLARIFY, FOLLOW_UP, DIFFICULTY_UP, DIFFICULTY_DOWN, STATE_TRANSITION
        - difficulty_adjustment: DIFFICULTY_UP, DIFFICULTY_DOWN, NONE
        - state_transition: explicit next state (technical, behavioral, pressure, closing, null)
        
        Args:
            technical_score: 0-100 technical accuracy
            relevance_score: 0-100 answer relevance
            clarity_score: 0-100 communication clarity
            confidence_score: 0-100 confidence level
            recommended_action: Action from analyzer
            difficulty_adjustment: Difficulty up/down/none
            state_transition: Explicit state or None for automatic
        
        Returns:
            True if transition succeeded, False otherwise
        """
        if self.current_state is None:
            logger.error("❌ Orchestrator not initialized")
            return False

        # Adjust difficulty based on analyzer feedback
        if difficulty_adjustment == "DIFFICULTY_UP":
            self.difficulty_level = min(3, self.difficulty_level + 1)
            logger.info(f"📈 Difficulty increased to level {self.difficulty_level}")
        elif difficulty_adjustment == "DIFFICULTY_DOWN":
            self.difficulty_level = max(1, self.difficulty_level - 1)
            logger.info(f"📉 Difficulty decreased to level {self.difficulty_level}")

        # Determine next state based on analyzer recommendation
        if state_transition and state_transition != "null":
            try:
                target_state = SessionState(state_transition)
                return await self.transition_to(
                    target_state=target_state,
                    reason=f"Analyzer: {recommended_action} (scores: T={technical_score}, R={relevance_score}, C={clarity_score}, Co={confidence_score})",
                    metrics={
                        "technical_score": technical_score,
                        "relevance_score": relevance_score,
                        "clarity_score": clarity_score,
                        "confidence_score": confidence_score,
                        "recommended_action": recommended_action,
                        "difficulty_level": self.difficulty_level
                    }
                )
            except ValueError as e:
                logger.error(f"❌ Invalid state transition: {state_transition}: {e}")
        else:
            # Auto-transition based on current state and scores
            if self.current_state == SessionState.INTRO:
                return await self.transition_to(SessionState.WARMUP, reason="Intro complete")
            elif self.current_state == SessionState.WARMUP:
                return await self.transition_to(SessionState.TECHNICAL, reason="Warmup complete")
            elif self.current_state == SessionState.TECHNICAL:
                # Strong performance? Go to PRESSURE. Else go to BEHAVIORAL.
                if technical_score > 75 and difficulty_adjustment == "DIFFICULTY_UP":
                    return await self.transition_to(SessionState.PRESSURE, reason="Strong technical, pressure mode")
                else:
                    return await self.transition_to(SessionState.BEHAVIORAL, reason="Technical phase complete")
            elif self.current_state == SessionState.BEHAVIORAL:
                # Strong overall? Go to CLOSING. Else go to PRESSURE for edge cases.
                if clarity_score > 70 and confidence_score > 65:
                    return await self.transition_to(SessionState.CLOSING, reason="Strong behavioral")
                else:
                    return await self.transition_to(SessionState.PRESSURE, reason="Pressure scenarios needed")
            elif self.current_state == SessionState.PRESSURE:
                return await self.transition_to(SessionState.CLOSING, reason="Pressure phase complete")
            elif self.current_state == SessionState.CLOSING:
                return await self.transition_to(SessionState.COMPLETED, reason="Interview complete")

        # Store analyzer feedback for question generation
        self.last_analyzer_feedback = {
            "technical_score": technical_score,
            "relevance_score": relevance_score,
            "clarity_score": clarity_score,
            "confidence_score": confidence_score,
            "filler_words_detected": [],
            "recommended_action": recommended_action,
            "difficulty_adjustment": difficulty_adjustment,
            "state_transition": state_transition,
        }
        
        # Trigger adaptive question generation via prompt chaining
        if candidate_transcript:
            self.last_candidate_transcript = candidate_transcript
            try:
                next_question = await self.generate_next_question(candidate_transcript, self.last_analyzer_feedback)
                if next_question:
                    from app.websocket_manager import connection_manager
                    await connection_manager.broadcast_transcript(
                        session_id=self.session_id,
                        message={
                            "type": "ai_question_generated",
                            "text": next_question,
                            "state": self.current_state.value if self.current_state else "unknown",
                            "difficulty": self.difficulty_level,
                            "timestamp_ms": int(datetime.utcnow().timestamp() * 1000)
                        }
                    )
            except Exception as e:
                logger.warning(f"⚠️  Failed to generate adaptive question: {e}")
        
        return False

    async def handle_interruption(self) -> None:
        """
        Handle candidate interruption (VAD detected while AI is speaking).
        
        - Stops TTS stream immediately
        - Broadcasts "listening" status
        - Remains in current state (orchestrator doesn't change state on interrupt)
        """
        try:
            from app.websocket_manager import connection_manager
            logger.info(f"🎙️  Interruption detected in session {self.session_id}")
            
            # Broadcast interruption event
            await connection_manager.broadcast_state_change(
                session_id=self.session_id,
                state="listening",
                metadata={
                    "event": "interruption",
                    "timestamp_ms": int(datetime.utcnow().timestamp() * 1000)
                }
            )
            
            # Log to database
            await self.db.execute(
                text(
                    "INSERT INTO agora_events_log (session_id, event_type, event_data) "
                    "VALUES (:session_id, :event_type, :event_data)"
                ),
                {
                    "session_id": self.session_id,
                    "event_type": "interruption",
                    "event_data": "Candidate spoke while AI was speaking"
                }
            )
            await self.db.commit()
        except Exception as e:
            logger.error(f"❌ Failed to handle interruption: {e}")

    async def generate_next_question(self, candidate_transcript: str, analyzer_feedback: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """
        Generate next interview question using prompt chaining.
        
        Uses the prompt chain coordinator to generate adaptive questions
        based on blueprint context, current state, and analyzer feedback.
        
        Args:
            candidate_transcript: Candidate's last response text
            analyzer_feedback: Optional analyzer output for adaptive behavior
        
        Returns:
            Generated question text, or None if generation fails
        """
        if not self.prompt_coordinator:
            logger.warning("⚠️  No prompt coordinator available, cannot generate adaptive question")
            return None
        
        try:
            from app.interview.prompt_chaining import QuestionGenerationRequest
            
            request = QuestionGenerationRequest(
                session_id=self.session_id,
                current_state=self.current_state.value if self.current_state else "intro",
                difficulty_level=self.difficulty_level,
                candidate_transcript=candidate_transcript or self.last_candidate_transcript,
                candidate_name=self.candidate_name,
                target_role=self.target_role,
                priority_competencies=self.priority_competencies,
                resume_claims=self.resume_claims,
                previous_weaknesses=self.previous_weaknesses,
                experience_level=self.experience_level,
                analyzer_feedback=analyzer_feedback or self.last_analyzer_feedback,
            )
            
            generated_question = await self.prompt_coordinator.generate_next_question(request)
            self.last_candidate_transcript = candidate_transcript or self.last_candidate_transcript
            self.last_analyzer_feedback = analyzer_feedback or self.last_analyzer_feedback
            
            logger.info(f"✅ Generated adaptive question for session {self.session_id}: {generated_question.question_text[:80]}...")
            return generated_question.question_text
            
        except Exception as e:
            logger.error(f"❌ Failed to generate next question: {e}")
            return None

    async def end_interview(self, reason: str = "user_requested") -> bool:
        """
        End the interview and transition to COMPLETED.
        
        Args:
            reason: Why the interview is ending (user_requested, timeout, error)
        
        Returns:
            True if transition succeeded
        """
        return await self.transition_to(
            target_state=SessionState.COMPLETED,
            reason=f"Interview ended: {reason}",
            metrics={"duration_ms": self.duration_ms, "questions_asked": self.question_count}
        )

    def get_current_state(self) -> Optional[SessionState]:
        """Get the current interview state"""
        return self.current_state

    def get_state_history(self) -> list[StateMetadata]:
        """Get the full state transition history"""
        return self.state_history

    def get_difficulty_level(self) -> int:
        """Get current difficulty level (1=easy, 2=medium, 3=hard)"""
        return self.difficulty_level

    def get_question_count(self) -> int:
        """Get number of questions asked so far"""
        return self.question_count

    async def close(self) -> None:
        """Clean up orchestrator resources"""
        try:
            logger.info(f"🧹 Closing orchestrator for session {self.session_id}")
        except Exception as e:
            logger.error(f"❌ Error closing orchestrator: {e}")
