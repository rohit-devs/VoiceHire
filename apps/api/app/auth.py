"""
Auth: verifies Clerk or Better Auth JWT and maps the identity to a persistent database user.

In demo mode (local development only), a demo user is returned without a valid token.
In production, a valid Bearer token is required on every protected endpoint
and WebSocket connection.

Provider selection (in priority order):
  1. Clerk        — when CLERK_SECRET_KEY + CLERK_JWT_JWKS_URL are set
  2. Better Auth  — when BETTER_AUTH_SECRET is set (>=32 chars)
  3. Demo / no-auth
"""

import logging
import time
from typing import Optional
from fastapi import Request, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import httpx
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db, async_session
from app.models import User

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

_DEMO_USER = {
    "id": "demo-user-001",
    "email": "demo@voicehire.ai",
    "clerk_id": "demo-user",
    "first_name": "Demo",
    "last_name": "User",
}

# Simple in-memory JWKS cache with TTL — shared key, differentiated by URL
_jwks_cache: dict = {}
_JWKS_TTL = 300  # 5 minutes


async def _fetch_jwks(url: str) -> dict:
    """Fetch and cache JWKS from any URL (Clerk or Better Auth)."""
    now = time.time()
    entry = _jwks_cache.get(url)
    if entry and now < entry.get("expires", 0):
        return entry["data"]
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=5.0)
        resp.raise_for_status()
        jwks = resp.json()
    _jwks_cache[url] = {"data": jwks, "expires": now + _JWKS_TTL}
    return jwks


async def _get_jwks() -> dict:
    """Fetch and cache Clerk JWKS."""
    return await _fetch_jwks(settings.CLERK_JWT_JWKS_URL)


async def _verify_clerk_token(token: str) -> dict:
    """Verify a Clerk JWT and return decoded payload."""
    if not settings.CLERK_JWT_JWKS_URL:
        raise HTTPException(status_code=401, detail="Clerk JWKS URL not configured")
    jwks = await _get_jwks()

    try:
        unverified = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc
    kid = unverified.get("kid")
    key_data = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if not key_data:
        raise HTTPException(status_code=401, detail="Invalid token: key not found")

    try:
        public_key = jwt.PyJWK.from_dict(key_data).key
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=settings.CLERK_JWT_JWKS_URL.replace("/.well-known/jwks.json", ""),
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc

    return {
        "id": payload.get("sub", "unknown"),
        "email": payload.get("email", payload.get("email_address", "unknown")),
        "clerk_id": payload.get("sub", "unknown"),
        "first_name": payload.get("given_name", None),
        "last_name": payload.get("family_name", None),
        "avatar_url": payload.get("picture", None),
    }


async def _verify_better_auth_token(token: str) -> dict:
    """Verify a Better Auth RS256 JWT via its JWKS endpoint.

    BA JWT claims used:
      sub  — BA user ID (used as both our 'id' and 'clerk_id' for DB lookup)
      email, name — user profile fields
    """
    if not settings.better_auth_enabled:
        raise HTTPException(status_code=401, detail="Better Auth not configured")
    jwks_url = settings.better_auth_jwks_url
    jwks = await _fetch_jwks(jwks_url)

    try:
        unverified = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc

    kid = unverified.get("kid")
    # BA may not always set kid — fall back to first key
    keys = jwks.get("keys", [])
    if kid:
        key_data = next((k for k in keys if k.get("kid") == kid), None)
    else:
        key_data = keys[0] if keys else None
    if not key_data:
        raise HTTPException(status_code=401, detail="Invalid token: BA key not found")

    try:
        public_key = jwt.PyJWK.from_dict(key_data).key
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc

    user_id = payload.get("sub", "unknown")
    name: str = payload.get("name", "")
    name_parts = name.split(" ", 1) if name else ["", ""]
    return {
        "id": user_id,
        "email": payload.get("email", "unknown"),
        # clerk_id field re-used as the universal external-identity key
        "clerk_id": f"ba_{user_id}",
        "first_name": name_parts[0] or None,
        "last_name": name_parts[1] if len(name_parts) > 1 else None,
        "avatar_url": payload.get("image", None),
    }


async def _upsert_user(user_info: dict, db: Optional[AsyncSession] = None) -> dict:
    """Upsert a user record into the database, returning the persisted user dict.

    Works with both SQLite and PostgreSQL schemas.
    """
    own_session = False
    if db is None:
        db = async_session()
        own_session = True
    try:
        user = await db.scalar(select(User).where(User.clerk_id == user_info["clerk_id"]))
        if user is None:
            user = User(
                id=user_info["id"],
                email=user_info["email"],
                clerk_id=user_info["clerk_id"],
                first_name=user_info.get("first_name"),
                last_name=user_info.get("last_name"),
                avatar_url=user_info.get("avatar_url"),
            )
            db.add(user)
        else:
            user.email = user_info["email"]
            user.first_name = user_info.get("first_name")
            user.last_name = user_info.get("last_name")
            user.avatar_url = user_info.get("avatar_url")
        await db.commit()
        return user_info
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("Failed to upsert user %s", user_info["id"])
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="User persistence unavailable",
        ) from exc
    finally:
        if own_session:
            await db.close()


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    FastAPI dependency that returns the authenticated user as a dict.

    Provider selection (priority order):
      1. Clerk        — CLERK_SECRET_KEY + CLERK_JWT_JWKS_URL set
      2. Better Auth  — BETTER_AUTH_SECRET set (>=32 chars)
      3. Demo / unauthenticated

    In demo mode (local dev): returns the demo user without a token.
    In production: valid Bearer token required.
    """
    any_auth_enabled = settings.clerk_enabled or settings.better_auth_enabled

    # ── Demo / no-auth mode ───────────────────────────────────────────────────
    if not any_auth_enabled or (settings.DEMO_MODE and not credentials):
        if settings.DEMO_MODE:
            await _upsert_user(_DEMO_USER, db)
            return _DEMO_USER.copy()

    # ── Token required ────────────────────────────────────────────────────────
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Bearer token required")

    token = credentials.credentials

    try:
        if settings.clerk_enabled:
            user_info = await _verify_clerk_token(token)
        elif settings.better_auth_enabled:
            user_info = await _verify_better_auth_token(token)
        else:
            raise HTTPException(status_code=401, detail="Auth provider not configured")
    except HTTPException:
        raise
    except Exception as exc:
        if settings.DEMO_MODE:
            logger.warning("Token verification error (demo fallback): %s", exc)
            await _upsert_user(_DEMO_USER, db)
            return _DEMO_USER.copy()
        raise HTTPException(status_code=503, detail=f"Auth service unavailable: {exc}")

    await _upsert_user(user_info, db)
    logger.info("Authenticated user: %s", user_info["id"])
    return user_info


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Returns just the user ID string for use in DB queries."""
    user = await get_current_user(credentials, db)
    return user["id"]


# Backwards-compatible alias used by app/routers/agora.py
require_clerk_jwt = get_current_user
