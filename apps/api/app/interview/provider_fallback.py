"""LLM provider fallback chain: Groq -> Ollama -> degraded."""

from __future__ import annotations

import logging
from typing import Optional, Sequence

from app.providers import ChatMessage, ProviderError, get_llm_provider

logger = logging.getLogger(__name__)

# Ordered list of provider factories to try, in preference order.
_PROVIDER_FACTORIES = [
    ("groq", lambda: _try_groq()),
    ("ollama", lambda: _try_ollama()),
]


def _try_groq() -> Optional[object]:
    provider = get_llm_provider()
    if provider.name == "groq":
        return provider
    return None


def _try_ollama() -> Optional[object]:
    provider = get_llm_provider()
    if provider.name == "ollama":
        return provider
    return None


class FallbackProvider:
    """Tries LLM providers in order; returns the first available one.

    Provider preference: Groq (fast, strong) -> Ollama (degraded local fallback).
    If neither is available, all complete() calls raise LLMUnavailable.

    Mirrors the calling convention of the providers in app/providers/llm.py:
    complete(messages, *, purpose, max_tokens) -> str.
    """

    def __init__(self) -> None:
        self._provider: Optional[object] = None
        self._resolved = False

    async def _resolve(self) -> object:
        if self._resolved:
            assert self._provider is not None
            return self._provider
        last_error: Optional[Exception] = None
        for name, factory in _PROVIDER_FACTORIES:
            try:
                provider = factory()
                if provider is not None:
                    logger.info("FallbackProvider resolved to %s", name)
                    self._provider = provider
                    self._resolved = True
                    return provider
            except ProviderError as exc:
                last_error = exc
                logger.warning("FallbackProvider: %s unavailable: %s", name, exc)
        self._resolved = True
        self._provider = None
        if last_error:
            from app.interview.llm_provider import LLMUnavailable

            raise LLMUnavailable(f"No LLM provider available: {last_error}")
        from app.interview.llm_provider import LLMUnavailable

        raise LLMUnavailable("No LLM provider available (Groq and Ollama both unavailable).")

    @property
    def name(self) -> str:
        if self._provider is not None:
            return self._provider.name
        return "fallback"

    @property
    def simulated(self) -> bool:
        if self._provider is not None:
            return getattr(self._provider, "simulated", False)
        return True

    def model_for(self, purpose: str) -> str:
        if self._provider is not None:
            return self._provider.model_for(purpose)
        return ""

    async def complete(
        self,
        messages: Sequence[ChatMessage],
        *,
        purpose: str = "live",
        max_tokens: int,
    ) -> str:
        provider = await self._resolve()
        if provider is None:
            from app.interview.llm_provider import LLMUnavailable

            raise LLMUnavailable("No LLM provider available.")
        try:
            return await provider.complete(
                messages,
                purpose=purpose,
                max_tokens=max_tokens,
            )
        except LLMUnavailable:
            # If the resolved provider becomes unavailable, try the next one.
            self._provider = None
            self._resolved = False
            provider = await self._resolve()
            if provider is None:
                raise
            return await provider.complete(
                messages,
                purpose=purpose,
                max_tokens=max_tokens,
            )
            return Completion(
                text=text,
                prompt_tokens=0,
                completion_tokens=0,
                provider=provider.name,
                model=provider.model_for(purpose),
            )
        except LLMUnavailable:
            # If the resolved provider becomes unavailable, try the next one.
            self._provider = None
            self._resolved = False
            provider = await self._resolve()
            if provider is None:
                raise
            text = await provider.complete(
                messages,
                purpose=purpose,
                max_tokens=max_tokens,
            )
            return Completion(
                text=text,
                prompt_tokens=0,
                completion_tokens=0,
                provider=provider.name,
                model=provider.model_for(purpose),
            )
