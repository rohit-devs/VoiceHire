"""Server-side Agora RTC token generation and channel naming."""

import time
from agora_token_builder import RtcTokenBuilder

from app.config import settings


class AgoraChannelConfig:
    """Canonical channel and participant identifiers for interview sessions."""

    CANDIDATE_UID = 1

    @staticmethod
    def generate_channel_name(session_id: str) -> str:
        return f"vh-{session_id}"


def generate_agora_token(
    channel_name: str,
    uid: int,
    role: str = "publisher",
    expire_seconds: int = 3600,
) -> str:
    """Generate an RTC token without exposing the Agora certificate to clients."""
    if not settings.AGORA_APP_ID or not settings.AGORA_APP_CERTIFICATE:
        raise ValueError("Agora credentials not configured")
    if role not in {"publisher", "subscriber"}:
        raise ValueError("role must be publisher or subscriber")
    if not 1 <= expire_seconds <= 3600:
        raise ValueError("Agora RTC tokens must expire within one hour")

    token_role = 1 if role == "publisher" else 2
    return RtcTokenBuilder.buildTokenWithUid(
        settings.AGORA_APP_ID,
        settings.AGORA_APP_CERTIFICATE,
        channel_name,
        uid,
        token_role,
        int(time.time()) + expire_seconds,
    )