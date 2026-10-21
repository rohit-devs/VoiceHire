"""Persistent interview lifecycle state machine."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InterviewSession

logger = logging.getLogger(__name__)


class SessionState(str, Enum):
    CREATED = "created"
    READY = "ready"
    CONNECTING = "connecting"
    INTERVIEWING = "interviewing"
    PROCESSING_RESPONSE = "processing_response"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class InterviewOrchestrator:
    TRANSITION_RULES: dict[SessionState, set[SessionState]] = {
        SessionState.CREATED: {SessionState.READY, SessionState.CANCELLED, SessionState.FAILED},
        SessionState.READY: {SessionState.CONNECTING, SessionState.CANCELLED, SessionState.FAILED},
        SessionState.CONNECTING: {
            SessionState.INTERVIEWING,
            SessionState.CANCELLED,
            SessionState.FAILED,
        },
        SessionState.INTERVIEWING: {
            SessionState.PROCESSING_RESPONSE,
            SessionState.COMPLETED,
            SessionState.CANCELLED,
            SessionState.FAILED,
        },
        SessionState.PROCESSING_RESPONSE: {
            SessionState.INTERVIEWING,
            SessionState.COMPLETED,
            SessionState.CANCELLED,
            SessionState.FAILED,
        },
        SessionState.COMPLETED: set(),
        SessionState.FAILED: set(),
        SessionState.CANCELLED: set(),
    }

    def __init__(
        self,
        session_id: str,
        db: AsyncSession,
        blueprint: dict[str, Any] | None = None,
    ) -> None:
        self.session_id = session_id
        self.db = db
        self.blueprint = blueprint or {}
        self.current_state: SessionState | None = None

    async def initialize(self) -> InterviewSession:
        session = await self.db.get(InterviewSession, self.session_id)
        if session is None:
            raise LookupError(f"Interview session {self.session_id} not found")
        self.current_state = SessionState(session.current_state)
        return session

    async def transition_to(self, target: SessionState, reason: str) -> bool:
        if self.current_state is None:
            await self.initialize()
        assert self.current_state is not None
        if target not in self.TRANSITION_RULES[self.current_state]:
            logger.info(
                "Rejected interview state transition session_id=%s from=%s to=%s",
                self.session_id,
                self.current_state.value,
                target.value,
            )
            return False

        session = await self.db.get(InterviewSession, self.session_id)
        if session is None:
            raise LookupError(f"Interview session {self.session_id} not found")
        if session.current_state != self.current_state.value:
            self.current_state = SessionState(session.current_state)
            return False

        now = datetime.now(timezone.utc)
        history = list(session.state_history or [])
        history.append(
            {
                "from": self.current_state.value,
                "to": target.value,
                "reason": reason,
                "at": now.isoformat(),
            }
        )
        values: dict[str, Any] = {
            "current_state": target.value,
            "status": target.value,
            "state_updated_at": now,
            "state_history": history,
        }
        if target == SessionState.CONNECTING and session.started_at is None:
            values["started_at"] = now
        if target in {SessionState.COMPLETED, SessionState.CANCELLED, SessionState.FAILED}:
            values["ended_at"] = now

        result = await self.db.execute(
            update(InterviewSession)
            .where(
                InterviewSession.id == self.session_id,
                InterviewSession.current_state == self.current_state.value,
            )
            .values(**values)
        )
        if result.rowcount != 1:
            await self.db.rollback()
            return False
        await self.db.commit()
        previous = self.current_state
        self.current_state = target

        from app.websocket_manager import connection_manager

        await connection_manager.broadcast_state_change(
            session_id=self.session_id,
            state=target.value,
            metadata={"previous_state": previous.value, "reason": reason, "at": now.isoformat()},
        )
        return True

    async def start(self) -> None:
        if self.current_state is None:
            await self.initialize()
        for target in (SessionState.READY, SessionState.CONNECTING, SessionState.INTERVIEWING):
            if self.current_state == target:
                continue
            if not await self.transition_to(target, "candidate_started"):
                raise ValueError(
                    f"Invalid session transition from {self.current_state.value} to {target.value}"
                )

    async def end(self) -> bool:
        if self.current_state is None:
            await self.initialize()
        if self.current_state in {SessionState.COMPLETED, SessionState.CANCELLED}:
            return True
        return await self.transition_to(SessionState.COMPLETED, "candidate_ended")
