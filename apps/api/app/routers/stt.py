"""Recorded-audio transcription endpoint."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import InterviewSession
from app.providers import ProviderError, get_stt_provider

router = APIRouter()
MAX_AUDIO_BYTES = 12 * 1024 * 1024


def _provider_http_exception(error: ProviderError) -> HTTPException:
    return HTTPException(
        status_code=429 if error.status == 429 else 503,
        detail={"user_message": error.user_message},
    )


@router.post("/transcribe")
async def transcribe_audio(
    session_id: str,
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    session = await db.get(InterviewSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if session.user_id != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied to this session")
    if session.current_state != "interviewing":
        raise HTTPException(status_code=409, detail="Audio can only be transcribed during an interview")

    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=415,
            detail={"user_message": "The recorded audio format is not supported. Use text input instead."},
        )
    content = await audio.read(MAX_AUDIO_BYTES + 1)
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"user_message": "The audio recording is too large. Try a shorter answer or use text input."},
        )

    try:
        provider = get_stt_provider()
        text = await provider.transcribe(content, audio.content_type)
    except ProviderError as exc:
        raise _provider_http_exception(exc) from exc

    return {
        "text": text,
        "provider": provider.name,
        "model": getattr(provider, "model", provider.name),
    }
