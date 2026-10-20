import asyncio

import httpx
import pytest

from app.providers import (
    BrowserSTT,
    ChatMessage,
    DemoProvider,
    DemoSTT,
    DeepgramProvider,
    GroqProvider,
    ProviderError,
    get_llm_provider,
    get_stt_provider,
    provider_health,
)

MESSAGES = [ChatMessage("user", "Ask me one question.")]


def _clear(monkeypatch):
    for name in (
        "LLM_PROVIDER",
        "STT_PROVIDER",
        "GROQ_API_KEY",
        "DEEPGRAM_API_KEY",
        "DEMO_MODE",
    ):
        monkeypatch.delenv(name, raising=False)


def test_llm_defaults_to_demo_without_key(monkeypatch):
    _clear(monkeypatch)
    assert isinstance(get_llm_provider(), DemoProvider)


def test_demo_mode_wins_over_key_in_auto(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("DEMO_MODE", "true")
    assert isinstance(get_llm_provider(), DemoProvider)


def test_explicit_groq_without_key_is_an_error(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    with pytest.raises(ProviderError):
        get_llm_provider()


def test_stt_falls_back_to_browser_without_key(monkeypatch):
    _clear(monkeypatch)
    assert isinstance(get_stt_provider(), BrowserSTT)


def test_stt_demo_mode(monkeypatch):
    _clear(monkeypatch)
    monkeypatch.setenv("DEMO_MODE", "true")
    assert isinstance(get_stt_provider(), DemoSTT)


def test_health_reports_disabled_then_ok(monkeypatch):
    _clear(monkeypatch)
    health = provider_health()
    assert health["llm"]["status"] == "disabled"
    assert health["stt"]["status"] == "disabled"
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    monkeypatch.setenv("DEEPGRAM_API_KEY", "test-key")
    health = provider_health()
    assert health["llm"]["status"] == "ok"
    assert health["stt"]["status"] == "ok"


def test_groq_success():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer test-key"
        return httpx.Response(
            200, json={"choices": [{"message": {"content": " Hello there "}}]}
        )

    provider = GroqProvider("test-key", transport=httpx.MockTransport(handler))
    assert asyncio.run(provider.complete(MESSAGES)) == "Hello there"


def test_groq_retries_once_then_raises_on_429():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(429, headers={"retry-after": "0"})

    provider = GroqProvider("test-key", transport=httpx.MockTransport(handler))
    with pytest.raises(ProviderError) as info:
        asyncio.run(provider.complete(MESSAGES))
    assert calls["n"] == 2
    assert info.value.status == 429
    assert "free-tier" in info.value.user_message


def test_groq_non_retryable_error_fails_fast():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(401)

    provider = GroqProvider("bad-key", transport=httpx.MockTransport(handler))
    with pytest.raises(ProviderError):
        asyncio.run(provider.complete(MESSAGES))
    assert calls["n"] == 1


def test_report_purpose_uses_report_model():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["model"] = request.content.decode()
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    provider = GroqProvider(
        "k",
        model_live="live-model",
        model_report="report-model",
        transport=httpx.MockTransport(handler),
    )
    asyncio.run(provider.complete(MESSAGES, purpose="report"))
    assert "report-model" in seen["model"]


def test_deepgram_parses_transcript():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Token test-key"
        return httpx.Response(
            200,
            json={
                "results": {
                    "channels": [{"alternatives": [{"transcript": "I led a team."}]}]
                }
            },
        )

    provider = DeepgramProvider("test-key", transport=httpx.MockTransport(handler))
    assert asyncio.run(provider.transcribe(b"audio-bytes")) == "I led a team."


def test_deepgram_error_is_wrapped():
    provider = DeepgramProvider(
        "k", transport=httpx.MockTransport(lambda r: httpx.Response(500))
    )
    with pytest.raises(ProviderError):
        asyncio.run(provider.transcribe(b"audio-bytes"))
