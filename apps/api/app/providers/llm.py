"""LLM providers: Groq (OpenAI-compatible API), local Ollama, and a clearly labelled demo fallback.

Env vars:
  LLM_PROVIDER      auto | groq | openai_compatible | ollama | demo  (default: auto)
  LLM_API_KEY       API key for any OpenAI-compatible endpoint (falls back to GROQ_API_KEY)
  LLM_BASE_URL      Base URL for any OpenAI-compatible endpoint (falls back to GROQ_BASE_URL)
  LLM_MODEL_LIVE    Fast model for live interviewer turns (falls back to GROQ_MODEL_LIVE)
  LLM_MODEL_REPORT  Stronger model for evaluation/reports (falls back to GROQ_MODEL_REPORT)
  OLLAMA_BASE_URL   http://localhost:11434
  OLLAMA_MODEL      llama3.2:1b
  GROQ_API_KEY      key from console.groq.com
  GROQ_BASE_URL     default https://api.groq.com/openai/v1
  GROQ_MODEL_LIVE   fast model for live interviewer turns
  GROQ_MODEL_REPORT stronger model for evaluation/reports
  DEMO_MODE         true forces the demo provider when LLM_PROVIDER=auto

Gemini via AI Studio (free tier):
  LLM_PROVIDER=openai_compatible
  LLM_API_KEY=<key from aistudio.google.com>
  LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
  LLM_MODEL_LIVE=gemini-1.5-flash
  LLM_MODEL_REPORT=gemini-1.5-pro

Model names change over time. Check your provider's model list and override via env.
Requires `httpx` (add to apps/api dependencies if it is not already there).
"""
from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Optional, Sequence

import httpx

from app.config import settings

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


class OllamaProvider:
    """Local Ollama provider. Requests stay on the configured Ollama server."""

    name = "ollama"
    simulated = False

    def __init__(
        self,
        *,
        base_url: str = "http://localhost:11434",
        model: str = "llama3.2:1b",
        timeout: float = 120.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model_live = model
        self.model_report = model
        self.timeout = timeout

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
            "messages": [
                {"role": message.role, "content": message.content}
                for message in messages
            ],
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

            answer = data.get("message", {}).get("content", "")
            if not isinstance(answer, str) or not answer.strip():
                raise ProviderError(
                    "Ollama returned an empty or invalid response."
                )
            return answer.strip()
        except ProviderError:
            raise
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            raise ProviderError(
                f"Ollama HTTP error: {status}",
                status=status,
                retryable=status in RETRYABLE_STATUS,
            ) from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise ProviderError(
                "Ollama is unavailable. Check that Ollama is running "
                "and the requested model is installed.",
                retryable=True,
            ) from exc


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
        user_content = next(
            (message.content for message in reversed(messages) if message.role == "user"),
            "",
        )
        try:
            payload = json.loads(user_content)
        except json.JSONDecodeError:
            payload = {}
        conversation = payload.get("conversation", [])
        answers = [
            item.get("text", "").strip()
            for item in conversation
            if item.get("speaker") == "candidate" and item.get("text", "").strip()
        ]
        if answers:
            answer = answers[-1]
            answer_lower = answer.lower()
            if any(term in answer_lower for term in ("ignore", "disregard", "override")) and any(
                term in answer_lower for term in ("instruction", "rules", "system", "prompt")
            ):
                return "Let's focus on your experience for this role. What relevant example can you share?"
            quote = " ".join(answers[-1].split()[:10]).rstrip(".,!?;:")
            return f"You mentioned “{quote}.” What trade-off did you consider?"
        return (
            "[Simulated] Thanks. Can you walk me through a specific example "
            "and the result you achieved?"
        )


def get_llm_provider() -> GroqProvider | OllamaProvider | DemoProvider:
    choice = os.getenv("LLM_PROVIDER", settings.LLM_PROVIDER).strip().lower()
    # Generic OpenAI-compatible env vars take precedence; GROQ_* are fallbacks.
    api_key = (
        os.getenv("LLM_API_KEY", settings.LLM_API_KEY).strip()
        or os.getenv("GROQ_API_KEY", settings.GROQ_API_KEY).strip()
    )
    base_url = (
        os.getenv("LLM_BASE_URL", settings.LLM_BASE_URL).strip()
        or os.getenv("GROQ_BASE_URL", settings.GROQ_BASE_URL).strip()
    )
    model_live = (
        os.getenv("LLM_MODEL_LIVE", settings.LLM_MODEL_LIVE).strip()
        or os.getenv("GROQ_MODEL_LIVE", settings.GROQ_FAST_MODEL).strip()
    )
    model_report = (
        os.getenv("LLM_MODEL_REPORT", settings.LLM_MODEL_REPORT).strip()
        or os.getenv("GROQ_MODEL_REPORT", settings.GROQ_STRONG_MODEL).strip()
    )
    if choice == "demo":
        return DemoProvider()
    if choice == "ollama":
        return OllamaProvider(
            base_url=os.getenv("OLLAMA_BASE_URL", settings.OLLAMA_BASE_URL),
            model=os.getenv("OLLAMA_MODEL", settings.OLLAMA_MODEL),
        )
    if choice == "auto" and (
        env_flag("DEMO_MODE") or settings.DEMO_MODE or not api_key
    ):
        return DemoProvider()
    if choice not in {"auto", "groq", "openai_compatible"}:
        raise ProviderError(
            "Invalid LLM_PROVIDER. Choose auto, groq, openai_compatible, ollama, or demo."
        )
    if not api_key:
        raise ProviderError(
            "LLM_PROVIDER=groq/openai_compatible but LLM_API_KEY (or GROQ_API_KEY) is not set."
        )
    return GroqProvider(
        api_key,
        base_url=base_url,
        model_live=model_live,
        model_report=model_report,
    )
