"""Server-side Agora RTC token generation."""

from agora_token_builder import RtcTokenBuilder

from app.config import settings


def generate_agora_token(channel_name: str, uid: int, role: str = "publisher") -> str:
    """Generate an RTC token without exposing the Agora certificate to clients."""
    if not settings.AGORA_APP_ID or not settings.AGORA_APP_CERTIFICATE:
        raise ValueError("Agora credentials not configured")
    if role not in {"publisher", "subscriber"}:
        raise ValueError("role must be publisher or subscriber")

    token_role = 1 if role == "publisher" else 2
    return RtcTokenBuilder.buildTokenWithUid(
        settings.AGORA_APP_ID,
        settings.AGORA_APP_CERTIFICATE,
        channel_name,
        uid,
        token_role,
        settings.AGORA_TOKEN_EXPIRATION,
    )