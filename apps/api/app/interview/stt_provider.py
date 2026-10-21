"""Streaming speech-to-text providers."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Protocol
from urllib.parse import urlencode

import websockets

logger = logging.getLogger(__name__)


class STTUnavailable(RuntimeError):
    """Raised when the configured speech-to-text provider cannot transcribe audio."""


@dataclass(frozen=True)
class STTTranscript:
    text: str
    is_final: bool
    speech_final: bool


class STTProvider(Protocol):
    async def transcribe(
        self,
        audio_chunks: AsyncIterator[bytes],
        on_transcript: Callable[[STTTranscript], Awaitable[None]],
    ) -> None: ...


class _DeepgramConnection(Protocol):
    async def send(self, message: bytes | str) -> None: ...

    def __aiter__(self) -> AsyncIterator[str | bytes]: ...


class DeepgramProvider:
    """Bridge streamed browser audio to Deepgram's Nova live transcription API."""

    def __init__(self, api_key: str, model: str = "nova-3") -> None:
        self.api_key = api_key
        self.model = model

    @property
    def websocket_url(self) -> str:
        query = urlencode(
            {
                "model": self.model,
                "language": "en-US",
                "interim_results": "true",
                "smart_format": "true",
                "punctuate": "true",
                "endpointing": "300",
                "utterance_end_ms": "1000",
            }
        )
        return f"wss://api.deepgram.com/v1/listen?{query}"

    async def transcribe(
        self,
        audio_chunks: AsyncIterator[bytes],
        on_transcript: Callable[[STTTranscript], Awaitable[None]],
    ) -> None:
        try:
            async with websockets.connect(
                self.websocket_url,
                additional_headers={"Authorization": f"Token {self.api_key}"},
                max_size=2**20,
            ) as connection:
                sender = asyncio.create_task(self._send_audio(connection, audio_chunks))
                try:
                    async for raw_message in connection:
                        transcript = self._parse_result(raw_message)
                        if transcript is not None:
                            await on_transcript(transcript)
                finally:
                    sender.cancel()
                    try:
                        await sender
                    except asyncio.CancelledError:
                        pass
        except (OSError, TimeoutError, websockets.WebSocketException) as exc:
            logger.warning("Deepgram streaming failed error_type=%s", type(exc).__name__)
            raise STTUnavailable(
                "Deepgram speech recognition is unavailable. Use browser speech recognition or text input."
            ) from exc

    @staticmethod
    async def _send_audio(
        connection: _DeepgramConnection, audio_chunks: AsyncIterator[bytes]
    ) -> None:
        async for chunk in audio_chunks:
            if chunk:
                await connection.send(chunk)
        await connection.send(json.dumps({"type": "CloseStream"}))

    @staticmethod
    def _parse_result(raw_message: str | bytes) -> STTTranscript | None:
        try:
            payload: Any = json.loads(raw_message)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise STTUnavailable("Deepgram returned an invalid transcription event.") from exc
        if not isinstance(payload, dict) or payload.get("type") != "Results":
            return None
        channels = payload.get("channel")
        alternatives = channels.get("alternatives") if isinstance(channels, dict) else None
        alternative = alternatives[0] if isinstance(alternatives, list) and alternatives else None
        text = alternative.get("transcript", "").strip() if isinstance(alternative, dict) else ""
        if not text:
            return None
        return STTTranscript(
            text=text,
            is_final=payload.get("is_final") is True,
            speech_final=payload.get("speech_final") is True,
        )
