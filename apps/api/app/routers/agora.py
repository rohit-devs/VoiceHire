"""Agora RTC credentials scoped to owned interview sessions."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.agora.tokens import AgoraChannelConfig, generate_agora_token
from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.interview.orchestrator import SessionState
from app.models import InterviewSession

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Agora"])


class TokenRequest(BaseModel):
    session_id: str


class TokenResponse(BaseModel):
    token: str
    channel_name: str
    uid: int
    app_id: str
    expires_in_seconds: int


@router.post("/token", response_model=TokenResponse)
async def create_token(
    request: TokenRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    session = await db.get(InterviewSession, request.session_id)
    if session is None or session.user_id != user["id"]:
        raise HTTPException(status_code=404, detail="Interview session not found")
    interviewable_states = {
        SessionState.READY.value,
        SessionState.CONNECTING.value,
        SessionState.INTERVIEWING.value,
        SessionState.PROCESSING_RESPONSE.value,
    }
    if session.current_state not in interviewable_states:
        raise HTTPException(
            status_code=409,
            detail=f"Agora token unavailable while session is {session.current_state}",
        )
    if not settings.agora_enabled:
        raise HTTPException(
            status_code=503,
            detail="Agora RTC credentials are unavailable; continue with text input.",
        )

    expires_in = max(1, min(3600, settings.AGORA_TOKEN_EXPIRATION))
    channel_name = session.agora_channel
    uid = AgoraChannelConfig.CANDIDATE_UID
    try:
        token = generate_agora_token(
            channel_name=channel_name,
            uid=uid,
            role="publisher",
            expire_seconds=expires_in,
        )
    except (ValueError, TypeError) as exc:
        logger.warning("Agora token configuration rejected for session_id=%s", session.id)
        raise HTTPException(status_code=503, detail="Agora RTC token could not be generated") from exc
    except Exception as exc:
        logger.exception("Agora token generation failed for session_id=%s", session.id)
        raise HTTPException(status_code=503, detail="Agora RTC token could not be generated") from exc

    return TokenResponse(
        token=token,
        channel_name=channel_name,
        uid=uid,
        app_id=settings.AGORA_APP_ID,
        expires_in_seconds=expires_in,
    )
