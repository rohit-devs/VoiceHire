from types import SimpleNamespace

import pytest

from app.interview.llm_provider import GroqProvider, LLMUnavailable


class MockCompletions:
    def __init__(self, results):
        self.results = iter(results)
        self.calls = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        result = next(self.results)
        if isinstance(result, Exception):
            raise result
        return result


def _response(text="A specific interview question.", prompt_tokens=12, completion_tokens=7):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=text))],
        usage=SimpleNamespace(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        ),
    )


@pytest.mark.asyncio
async def test_groq_provider_returns_model_and_usage(monkeypatch):
    provider = GroqProvider("test-groq-key", model="strong-model", base_url="https://groq.test/v1")
    completions = MockCompletions([_response()])
    provider.client.chat.completions = completions

    result = await provider.complete(
        session_id="session-1",
        system_prompt="System",
        user_content="User",
        max_tokens=200,
    )

    assert result.text == "A specific interview question."
    assert result.provider == "groq"
    assert result.model == "strong-model"
    assert result.prompt_tokens == 12
    assert result.completion_tokens == 7
    assert completions.calls[0]["model"] == "strong-model"
    assert completions.calls[0]["max_tokens"] == 200


@pytest.mark.asyncio
async def test_groq_provider_retries_quota_once_then_returns_clear_fallback(monkeypatch):
    class RateLimitError(Exception):
        status_code = 429

    provider = GroqProvider("test-groq-key")
    completions = MockCompletions([RateLimitError("rate limit"), RateLimitError("rate limit")])
    provider.client.chat.completions = completions
    delays = []

    async def sleep(delay):
        delays.append(delay)

    monkeypatch.setattr("app.interview.llm_provider.asyncio.sleep", sleep)

    with pytest.raises(LLMUnavailable, match="free-tier limit"):
        await provider.complete(
            session_id="session-2",
            system_prompt="System",
            user_content="User",
            max_tokens=100,
        )

    assert len(completions.calls) == 2
    assert delays == [0.5]
