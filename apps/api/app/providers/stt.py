"""Speech-to-text providers.

Baseline: Deepgram prerecorded REST, one request per spoken answer. This is simpler and
more robust than a streaming bridge and is enough for turn-based interviews. Add a
streaming WebSocket bridge later if live interim captions are needed.

Env vars:
  STT_PROVIDER      auto | deepgram | browser | demo   (default: auto)
  DEEPGRAM_API_KEY  key from console.deepgram.com
  DEEPGRAM_MODEL    default nova-3 (override via env if unavailable)

`browser` means the frontend uses the Web Speech API and the backend does no STT.
"""
from __future__ import annotations

import os
from typing import Optional

import httpx

from .llm import ProviderError, env_flag
from app.config import settings

DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"
DEFAULT_MODEL = "nova-3"


class DeepgramProvider:
    name = "deepgram"
    simulated = False

    def __init__(
        self,
        api_key: str,
        *,
        model: Optional[str] = None,
        timeout: float = 30.0,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        self.api_key = api_key
        self.model = model or DEFAULT_MODEL
        self.timeout = timeout
        self._transport = transport

    async def transcribe(self, audio: bytes, content_type: str = "audio/webm") -> str:
        if not audio:
            return ""
        params = {"model": self.model, "smart_format": "true", "language": "en"}
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": content_type,
        }
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout, transport=self._transport
            ) as client:
                response = await client.post(
                    DEEPGRAM_URL, params=params, headers=headers, content=audio
                )
        except httpx.HTTPError as exc:
            raise ProviderError(f"deepgram network error: {exc}", retryable=True) from exc

        if response.status_code != 200:
            raise ProviderError(
                f"deepgram error {response.status_code}",
                status=response.status_code,
                retryable=response.status_code in {429, 500, 502, 503, 504},
            )
        try:
            data = response.json()
            return data["results"]["channels"][0]["alternatives"][0]["transcript"].strip()
        except (KeyError, IndexError, ValueError) as exc:
            raise ProviderError("deepgram returned an unexpected response") from exc


class DemoSTT:
    name = "demo"
    simulated = True

    async def transcribe(self, audio: bytes, content_type: str = "audio/webm") -> str:
        return "[Simulated transcript] I led a project and delivered it on time."


class BrowserSTT:
    """Marker provider: the browser's Web Speech API does the recognition."""

    name = "browser"
    simulated = False

    async def transcribe(self, audio: bytes, content_type: str = "audio/webm") -> str:
        raise ProviderError("STT runs in the browser; send text instead of audio")


def get_stt_provider() -> "DeepgramProvider | DemoSTT | BrowserSTT":
    choice = os.getenv("STT_PROVIDER", settings.STT_PROVIDER).strip().lower()
    key = os.getenv("DEEPGRAM_API_KEY", settings.DEEPGRAM_API_KEY).strip()

    # Explicit provider choice always wins over demo mode.
    if choice == "demo":
        return DemoSTT()
    if choice == "browser":
        return BrowserSTT()
    if choice == "deepgram":
        if not key:
            raise ProviderError("STT_PROVIDER=deepgram but DEEPGRAM_API_KEY is not set")
        return DeepgramProvider(key, model=os.getenv("DEEPGRAM_MODEL", settings.DEEPGRAM_MODEL) or None)

    # Auto mode: demo wins when DEMO_MODE is on; otherwise deepgram if a key exists; browser otherwise.
    if env_flag("DEMO_MODE") or settings.DEMO_MODE:
        return DemoSTT()
    if key:
        return DeepgramProvider(key, model=os.getenv("DEEPGRAM_MODEL", settings.DEEPGRAM_MODEL) or None)
    return BrowserSTT()
