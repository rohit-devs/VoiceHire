"""Persistence helpers for opt-in HTTP idempotency keys."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import IdempotencyRecord


async def cached_response(
    db: AsyncSession, user_id: str, operation: str, key: str | None
) -> dict[str, Any] | None:
    if key is None:
        return None
    record = await db.scalar(
        select(IdempotencyRecord).where(
            IdempotencyRecord.user_id == user_id,
            IdempotencyRecord.operation == operation,
            IdempotencyRecord.idempotency_key == key,
        )
    )
    return record.response_data if record else None


async def store_response(
    db: AsyncSession,
    user_id: str,
    operation: str,
    key: str | None,
    resource_id: str,
    response: dict[str, Any],
) -> None:
    if key is None:
        return
    db.add(
        IdempotencyRecord(
            user_id=user_id,
            operation=operation,
            idempotency_key=key,
            resource_id=resource_id,
            response_data=response,
        )
    )
    await db.flush()
