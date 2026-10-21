"""Atomic token-budget reservation and reconciliation."""

from __future__ import annotations

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InterviewSession, User

MAX_TOKENS_PER_SESSION = 12_000
MAX_TOKENS_PER_USER = 50_000


class TokenBudgetExceeded(Exception):
    pass


async def reserve_tokens(
    db: AsyncSession, *, user_id: str, session_id: str, estimated_tokens: int
) -> None:
    user_result = await db.execute(
        update(User)
        .where(
            User.id == user_id,
            User.llm_tokens_used <= MAX_TOKENS_PER_USER - estimated_tokens,
        )
        .values(llm_tokens_used=User.llm_tokens_used + estimated_tokens)
    )
    session_result = await db.execute(
        update(InterviewSession)
        .where(
            InterviewSession.id == session_id,
            InterviewSession.llm_tokens_used <= MAX_TOKENS_PER_SESSION - estimated_tokens,
        )
        .values(llm_tokens_used=InterviewSession.llm_tokens_used + estimated_tokens)
    )
    if user_result.rowcount != 1 or session_result.rowcount != 1:
        await db.rollback()
        raise TokenBudgetExceeded("The interview token budget is exhausted")
    await db.commit()


async def reconcile_tokens(
    db: AsyncSession,
    *,
    user_id: str,
    session_id: str,
    reserved_tokens: int,
    actual_tokens: int,
) -> None:
    delta = actual_tokens - reserved_tokens
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(llm_tokens_used=User.llm_tokens_used + delta)
    )
    await db.execute(
        update(InterviewSession)
        .where(InterviewSession.id == session_id)
        .values(llm_tokens_used=InterviewSession.llm_tokens_used + delta)
    )
    await db.commit()
