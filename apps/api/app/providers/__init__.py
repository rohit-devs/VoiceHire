"""Provider abstraction for LLM and STT.

`provider_health()` is config-based: "ok" means the provider is configured and selected,
"disabled" means it is not, "error" means the configuration is invalid. It does not call
the provider's network API, so it is cheap to call from /api/health/ready.
"""
from __future__ import annotations

from typing import Dict

from .llm import (
    ChatMessage,
    DemoProvider,
    GroqProvider,
    OllamaProvider,
    ProviderError,
    get_llm_provider,
)
from .stt import BrowserSTT, DeepgramProvider, DemoSTT, get_stt_provider

__all__ = [
    "ChatMessage",
    "DemoProvider",
    "GroqProvider",
    "OllamaProvider",
    "ProviderError",
    "get_llm_provider",
    "BrowserSTT",
    "DeepgramProvider",
    "DemoSTT",
    "get_stt_provider",
    "provider_health",
]


def _describe(factory) -> Dict[str, object]:
    try:
        provider = factory()
    except ProviderError as exc:
        return {"status": "error", "reason": str(exc)}
    if provider.name in {"demo", "browser"}:
        return {"status": "disabled", "using": provider.name}
    entry: Dict[str, object] = {"status": "ok", "using": provider.name}
    models = getattr(provider, "model_live", None)
    if models:
        entry["model_live"] = provider.model_live
        entry["model_report"] = provider.model_report
    return entry


def provider_health() -> Dict[str, Dict[str, object]]:
    return {"llm": _describe(get_llm_provider), "stt": _describe(get_stt_provider)}
