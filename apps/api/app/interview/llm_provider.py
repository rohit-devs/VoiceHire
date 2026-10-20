"""LLM providers: Groq (OpenAI-compatible API) and a clearly labelled demo fallback.

Env vars:
  LLM_PROVIDER      auto | groq | demo        (default: auto)
  GROQ_API_KEY      key from console.groq.com
  GROQ_BASE_URL     default https://api.groq.com/openai/v1
  GROQ_MODEL_LIVE   fast model for live interviewer turns
  GROQ_MODEL_REPORT stronger model for evaluation/reports
  DEMO_MODE         true forces the demo provider when LLM_PROVIDER=auto

Model names change over time. Check Groq's model list and override via env.
Requires `httpx` (add to apps/api dependencies if it is not already there).
"""
from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Optional, Sequence

import httpx

DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_MODEL_LIVE = "llama-3.1-8b-instant"
DEFAULT_MODEL_REPORT = "llama-3.3-70b-versatile"
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class ProviderError(Exception):
    """Raised when a provider fails after its retry. Safe to show `user_message`."""

    def __init__(
        self,
        message: str,
        *,
        status: Optional[int] = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.retryable = retryable

    @property
    def user_message(self) -> str:
        if self.status == 429:
            return (
                "The AI service is at its free-tier limit right now. "
                "Please wait a minute, switch to text answers, or use demo mode."
            )
        if self.retryable:
            return "The AI service is temporarily unavailable. Please try again."
        return "The AI service could not complete this request."


@dataclass(frozen=True)
class ChatMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


def env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _retry_delay(response: httpx.Response) -> float:
    raw = response.headers.get("retry-after", "")
    try:
        return min(max(float(raw), 0.0), 5.0)
    except ValueError:
        return 1.0


class GroqProvider:
    name = "groq"
    simulated = False

    def __init__(
        self,
        api_key: str,
        *,
        base_url: Optional[str] = None,
        model_live: Optional[str] = None,
        model_report: Optional[str] = None,
        timeout: float = 30.0,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        self.api_key = api_key
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self.model_live = model_live or DEFAULT_MODEL_LIVE
        self.model_report = model_report or DEFAULT_MODEL_REPORT
        self.timeout = timeout
        self._transport = transport

    def model_for(self, purpose: str) -> str:
        return self.model_report if purpose == "report" else self.model_live

    async def complete(
        self,
        messages: Sequence[ChatMessage],
        *,
        purpose: str = "live",
        temperature: float = 0.4,
        max_tokens: int = 600,
    ) -> str:
        payload = {
            "model": self.model_for(purpose),
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}
        last_error: Optional[ProviderError] = None

        for attempt in range(2):  # one retry, then give up
            delay = 1.0
            try:
                async with httpx.AsyncClient(
                    timeout=self.timeout, transport=self._transport
                ) as client:
                    response = await client.post(
                        f"{self.base_url}/chat/completions",
                        json=payload,
                        headers=headers,
                    )
            except httpx.HTTPError as exc:
                last_error = ProviderError(f"groq network error: {exc}", retryable=True)
            else:
                if response.status_code == 200:
                    try:
                        data = response.json()
                        return data["choices"][0]["message"]["content"].strip()
                    except (KeyError, IndexError, ValueError) as exc:
                        raise ProviderError("groq returned an unexpected response") from exc
                retryable = response.status_code in RETRYABLE_STATUS
                last_error = ProviderError(
                    f"groq error {response.status_code}",
                    status=response.status_code,
                    retryable=retryable,
                )
                if not retryable:
                    raise last_error
                delay = _retry_delay(response)

            if attempt == 0:
                await asyncio.sleep(delay)

        assert last_error is not None
        raise last_error


class DemoProvider:
    """No network, no keys. Output is always labelled as simulated."""

    name = "demo"
    simulated = True
    model_live = "demo"
    model_report = "demo"

    def model_for(self, purpose: str) -> str:
        return "demo"

    async def complete(
        self,
        messages: Sequence[ChatMessage],
        *,
        purpose: str = "live",
        temperature: float = 0.4,
        max_tokens: int = 600,
    ) -> str:
        if purpose == "report":
            return "[Simulated] Demo evaluation. Not based on a real AI assessment."
        return (
            "[Simulated] Thanks. Can you walk me through a specific example "
            "and the result you achieved?"
        )


def get_llm_provider() -> "GroqProvider | DemoProvider":
    choice = os.getenv("LLM_PROVIDER", "auto").strip().lower()
    key = os.getenv("GROQ_API_KEY", "").strip()

    if choice == "demo" or (choice == "auto" and (env_flag("DEMO_MODE") or not key)):
        return DemoProvider()
    if not key:
        raise ProviderError("LLM_PROVIDER=groq but GROQ_API_KEY is not set")
    return GroqProvider(
        key,
        base_url=os.getenv("GROQ_BASE_URL") or None,
        model_live=os.getenv("GROQ_MODEL_LIVE") or None,
        model_report=os.getenv("GROQ_MODEL_REPORT") or None,
    )