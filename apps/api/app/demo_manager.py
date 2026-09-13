"""
Demo Interview Session Manager - For testing WebSocket and real-time features

This module provides demo functionality for testing the interview room UI
without needing a full AI agent implementation.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Optional
from app.websocket_manager import connection_manager

logger = logging.getLogger(__name__)


class DemoSessionManager:
    """Manages demo interview sessions with simulated transcript and metrics"""

    def __init__(self):
        self.active_demos: dict[str, asyncio.Task] = {}

    async def start_demo_interview(self, session_id: str, duration_seconds: int = 60):
        """
        Start a demo interview session that simulates real-time messages.

        Args:
            session_id: Interview session ID
            duration_seconds: How long to run the demo (default 60 seconds)
        """
        if session_id in self.active_demos:
            logger.warning(f"Demo session {session_id} already running")
            return

        task = asyncio.create_task(
            self._run_demo_interview(session_id, duration_seconds)
        )
        self.active_demos[session_id] = task
        logger.info(f"✅ Started demo interview for session {session_id}")

    async def stop_demo_interview(self, session_id: str):
        """Stop a running demo interview session"""
        if session_id in self.active_demos:
            task = self.active_demos[session_id]
            task.cancel()
            del self.active_demos[session_id]
            logger.info(f"⏹️ Stopped demo interview for session {session_id}")

    async def _run_demo_interview(self, session_id: str, duration_seconds: int):
        """Run the demo interview loop"""
        try:
            # State progression
            states = ["intro", "warmup", "technical", "behavioral", "pressure", "closing"]
            state_transitions = [
                (0, "intro", "Hello! I'm your AI interviewer."),
                (3, "warmup", "Let's start with some warm-up questions."),
                (10, "technical", "Now let's dive into technical questions."),
                (25, "behavioral", "Tell me about a challenging project."),
                (40, "pressure", "What would you do if the deadline was moved up?"),
                (50, "closing", "Do you have any questions for me?"),
            ]

            demo_responses = [
                "I have 5 years of experience in backend development.",
                "I've worked with Python, JavaScript, and Go primarily.",
                "In my last role, I led the migration to microservices.",
                "I was responsible for designing the authentication system.",
                "The biggest challenge was managing technical debt while shipping features.",
                "I would communicate with stakeholders and reprioritize the roadmap.",
                "Yes, I'm interested in the team's tech stack and culture.",
            ]

            elapsed = 0
            response_index = 0
            current_state_idx = 0

            while elapsed < duration_seconds:
                # Check if we should transition to next state
                if (
                    current_state_idx < len(state_transitions)
                    and elapsed >= state_transitions[current_state_idx][0]
                ):
                    time_offset, new_state, ai_message = state_transitions[
                        current_state_idx
                    ]

                    # Broadcast state change
                    await connection_manager.broadcast_state_change(
                        session_id, new_state
                    )

                    # AI message
                    await connection_manager.broadcast_transcript(
                        session_id,
                        {
                            "type": "transcript",
                            "speaker": "interviewer",
                            "text": ai_message,
                            "timestamp_ms": elapsed * 1000,
                        },
                    )

                    current_state_idx += 1

                # Every 5 seconds, add candidate response
                if elapsed % 5 == 0 and response_index < len(demo_responses):
                    await connection_manager.broadcast_transcript(
                        session_id,
                        {
                            "type": "transcript",
                            "speaker": "candidate",
                            "text": demo_responses[response_index],
                            "timestamp_ms": elapsed * 1000,
                            "metrics": {
                                "wpm": 120 + (elapsed % 30),
                                "pause_ms": 200,
                                "filler_words": ["um", "like", "you know"][
                                    : max(0, elapsed // 20)
                                ],
                            },
                        },
                    )
                    response_index += 1

                # Every 3 seconds, broadcast metrics
                if elapsed % 3 == 0:
                    await connection_manager.broadcast_metrics(
                        session_id,
                        {
                            "type": "metrics",
                            "clarity_score": 70 + (elapsed % 30),
                            "confidence_score": 65 + (elapsed % 35),
                            "relevance_score": 75 + (elapsed % 25),
                            "filler_words_count": max(0, elapsed // 15),
                            "avg_wpm": 115 + (elapsed % 20),
                            "timestamp_ms": elapsed * 1000,
                        },
                    )

                # Random AI thinking
                if elapsed % 8 == 0:
                    await connection_manager.broadcast_ai_thinking(
                        session_id, {"type": "ai_thinking", "text": "Analyzing response..."}
                    )

                await asyncio.sleep(1)
                elapsed += 1

            # Send final evaluation
            await connection_manager.broadcast_evaluation_complete(
                session_id,
                {
                    "type": "evaluation_complete",
                    "report": {
                        "overall_score": 78,
                        "technical_score": 82,
                        "communication_score": 75,
                        "leadership_score": 72,
                        "strengths": [
                            "Clear technical knowledge",
                            "Good problem-solving approach",
                        ],
                        "areas_for_improvement": [
                            "Could provide more specific examples",
                            "Work on reducing filler words",
                        ],
                    },
                },
            )

            logger.info(f"✅ Demo interview completed for session {session_id}")

        except asyncio.CancelledError:
            logger.info(f"Demo interview cancelled for session {session_id}")
        except Exception as e:
            logger.error(f"❌ Error in demo interview {session_id}: {e}")


# Global instance
demo_manager = DemoSessionManager()
