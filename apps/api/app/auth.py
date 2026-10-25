"""
Auth: resolves anonymous guest identity and maps it to a persistent database user.

Every visitor is treated as a guest. The guest identity is established by a
cryptographically random cookie (Secure, HttpOnly, SameSite=Strict) issued by
the backend, or by a strictly validated `X-Guest-Id` header (UUID v4) for
non-cookie clients. The backend issues the cookie on first visit; the client
never chooses its own guest ID unless explicitly passing a pre-existing one.

Provider selection:
  1. Guest cookie (Secure, HttpOnly, SameSite=Strict)
  2. X-Guest-Id header (UUID v4, strictly validated)
  3. New guest — backend generates a UUID and sets the cookie
"""

import logging
import re
import time
import uuid
from typing import Optional
from fastapi import Request, HTTPException, Depends, status, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db, async_session
from app.models import User

logger = logging.getLogger(__name__)

# Accept the legacy Authorization header only for backward compatibility during
# migration; the primary guest credential is the cookie or X-Guest-Id header.
security = HTTPBearer(auto_error=False)

_GUEST_COOKIE_NAME = "vh_guest_id"
_GUEST_COOKIE_MAX_AGE = 365 * 24 * 60 * 60  # 1 year

_UUID_V4_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _is_valid_uuid_v4(value: str) -> bool:
    """Strictly validate a UUID v4 string."""
    return bool(_UUID_V4_RE.match(value or ""))


def _generate_guest_id() -> str:
    """Generate a cryptographically random UUID v4 guest identifier."""
    return str(uuid.uuid4())


async def _upsert_guest_user(guest_id: str, db: AsyncSession) -> dict:
    """Upsert a guest user record, returning the persisted user dict."""
    try:
        user = await db.scalar(select(User).where(User.guest_id == guest_id))
        if user is None:
            user = User(
                id=guest_id,
                guest_id=guest_id,
                email=None,
                first_name=None,
                last_name=None,
            )
            db.add(user)
        await db.commit()
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("Failed to upsert guest user %s", guest_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="User persistence unavailable",
        ) from exc
    return {
        "id": user.id,
        "guest_id": user.guest_id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }


async def get_current_user(
    request: Request,
    response: Response,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    FastAPI dependency that resolves the guest identity and returns a user dict.

    Resolution order:
      1. `X-Guest-Id` header (UUID v4, strictly validated) — authoritative
      2. `vh_guest_id` cookie (Secure, HttpOnly, SameSite=Strict) — fallback
      3. Backend-generated UUID — set as a Secure cookie on the response

    Never trusts a user ID supplied in a request body. All interview, session,
    transcript, WebSocket, evaluation, coaching-plan, and report routes resolve
    the guest identity here and enforce ownership server-side.
    """
    # ── 1. X-Guest-Id header (authoritative client identity) ──────────────────
    header_guest_id = request.headers.get("x-guest-id")
    if header_guest_id:
        if not _is_valid_uuid_v4(header_guest_id):
            raise HTTPException(
                status_code=400, detail="X-Guest-Id must be a valid UUID v4"
            )
        user = await _upsert_guest_user(header_guest_id, db)
        # Sync the cookie to the header so a stale Secure cookie cannot
        # override the frontend's localStorage-driven guest ID on HTTPS.
        response.set_cookie(
            key=_GUEST_COOKIE_NAME,
            value=header_guest_id,
            max_age=_GUEST_COOKIE_MAX_AGE,
            httponly=True,
            secure=True,
            samesite="strict",
            path="/",
        )
        logger.info("Authenticated guest: %s (X-Guest-Id header)", user["id"])
        return user

    # ── 2. Guest cookie (Secure, HttpOnly, SameSite=Strict) ──────────────────
    cookie_guest_id = request.cookies.get(_GUEST_COOKIE_NAME)
    if cookie_guest_id and _is_valid_uuid_v4(cookie_guest_id):
        user = await _upsert_guest_user(cookie_guest_id, db)
        logger.info("Authenticated guest: %s (cookie)", user["id"])
        return user

    # ── 3. Backend-generated guest ──────────────────────────────────────────
    new_guest_id = _generate_guest_id()
    user = await _upsert_guest_user(new_guest_id, db)
    response.set_cookie(
        key=_GUEST_COOKIE_NAME,
        value=new_guest_id,
        max_age=_GUEST_COOKIE_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/",
    )
    logger.info("Authenticated guest: %s (new)", user["id"])
    return user


async def get_current_user_id(
    request: Request,
    response: Response,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Returns just the guest user ID string for use in DB queries."""
    user = await get_current_user(request, response, credentials, db)
    return user["id"]
