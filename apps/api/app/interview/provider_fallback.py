"""LLM provider fallback chain: Groq -> Ollama -> degraded."""

from __future__ import annotations

import logging
from typing import Optional

from app.interview.llm_provider import Completion, LLMProvider, LLMUnavailable
from app.providers import ProviderError, get_llm_provider

logger = logging.getLogger(__name__)

# Ordered list of provider factories to try, in preference order.
_PROVIDER_FACTORIES = [
    ("groq", lambda: _try_groq()),
    ("ollama", lambda: _try_ollama()),
]


def _try_groq() -> Optional[LLMProvider]:
    provider = get_llm_provider()
    if provider.name == "groq":
        return provider
    return None


def _try_ollama() -> Optional[LLMProvider]:
    provider = get_llm_provider()
    if provider.name == "ollama":
        return provider
    return None


class FallbackProvider:
    """Tries LLM providers in order; returns the first available one.

    Provider preference: Groq (fast, strong) -> Ollama (degraded local fallback).
    If neither is available, all complete() calls raise LLMUnavailable.
    """

    def __init__(self) -> None:
        self._provider: Optional[LLMProvider] = None
        self._resolved = False

    async def _resolve(self) -> LLMProvider:
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
            raise LLMUnavailable(f"No LLM provider available: {last_error}")
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

    async def complete(
        self,
        *,
        session_id: str,
        system_prompt: str,
        user_content: str,
        max_tokens: int,
    ) -> Completion:
        provider = await self._resolve()
        if provider is None:
            raise LLMUnavailable("No LLM provider available.")
        try:
            return await provider.complete(
                session_id=session_id,
                system_prompt=system_prompt,
                user_content=user_content,
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
                session_id=session_id,
                system_prompt=system_prompt,
                user_content=user_content,
                max_tokens=max_tokens,
            )
