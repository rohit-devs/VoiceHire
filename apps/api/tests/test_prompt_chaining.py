"""Tests for PromptChainCoordinator question generation."""
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from app.interview.prompt_chaining import (
    GeneratedQuestionPayload,
    PromptChainCoordinator,
    QuestionGenerationRequest,
)


def _make_request() -> QuestionGenerationRequest:
    return QuestionGenerationRequest(
        session_id="test-session",
        current_state="interviewing",
        difficulty_level=2,
        blueprint={
            "role": "Backend Engineer",
            "experience_level": "Mid (3-5 years)",
            "interviewer_type": "technical",
            "job_description": "Build APIs.",
            "resume_text": "Python, FastAPI, PostgreSQL.",
            "job_category": "backend",
        },
        conversation=[
            {"speaker": "interviewer", "text": "Tell me about yourself."},
            {"speaker": "candidate", "text": "I am a backend engineer."},
        ],
        elapsed_seconds=120,
        question_budget=10,
        is_opener=False,
    )


def _make_provider(completion_text: str, prompt_tokens: int = 50, completion_tokens: int = 30):
    """Mock provider that returns the given text."""
    async def complete(
        *,
        session_id: str,
        system_prompt: str,
        user_content: str,
        max_tokens: int,
        format: str | None = None,
    ):
        from app.interview.llm_provider import Completion
        return Completion(
            text=completion_text,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            provider="test",
            model="test-model",
        )
    return AsyncMock(wraps=complete)


@pytest.mark.asyncio
async def test_generate_next_question_passes_format_parameter(monkeypatch):
    """provider.complete must receive format=json schema to constrain Ollama output."""
    from app.interview import prompt_chaining

    captured = {}

    async def fake_complete(
        *,
        session_id: str,
        system_prompt: str,
        user_content: str,
        max_tokens: int,
        format: str | None = None,
    ):
        captured["format"] = format
        from app.interview.llm_provider import Completion
        return Completion(
            text=json.dumps({
                "question_text": "What is your experience with Python?",
                "reasoning": "Follow up on candidate's background.",
                "difficulty_level": 2,
            }),
            prompt_tokens=50,
            completion_tokens=30,
            provider="ollama",
            model="llama3.2:1b",
        )

    coordinator = PromptChainCoordinator.__new__(PromptChainCoordinator)
    coordinator.provider = AsyncMock()
    coordinator.provider.complete = fake_complete
    coordinator.system_prompt = "You are an interviewer."

    request = _make_request()
    result = await coordinator.generate_next_question(request)

    assert captured["format"] is not None
    schema = json.loads(captured["format"])
    assert "question_text" in schema["properties"]
    assert result.question_text == "What is your experience with Python?"
    assert not result.degraded


@pytest.mark.asyncio
async def test_parse_llm_output_rejects_prompt_echo():
    """Ollama output wrapping a question in prose must be rejected."""
    coordinator = PromptChainCoordinator.__new__(PromptChainCoordinator)

    result = coordinator._parse_llm_output(
        'Here\'s a clear question to follow up on the candidate\'s answer:\n\n'
        '"Can you give an example of a project where you optimized API latency?"',
        set(),
    )
    assert result is None, f"Prompt echo should be rejected, got: {result}"


@pytest.mark.asyncio
async def test_parse_llm_output_rejects_json_in_prose():
    """JSON object embedded in prose must be rejected (regression for f05b575)."""
    coordinator = PromptChainCoordinator.__new__(PromptChainCoordinator)

    result = coordinator._parse_llm_output(
        'Here\'s a clear question for the candidate: {"task": "...", "format": "json", "schema": {...}}',
        set(),
    )
    assert result is None, f"JSON-in-prose should be rejected, got: {result}"


@pytest.mark.asyncio
async def test_parse_llm_output_accepts_clean_json():
    """Valid JSON matching GeneratedQuestionPayload schema should be accepted."""
    coordinator = PromptChainCoordinator.__new__(PromptChainCoordinator)

    result = coordinator._parse_llm_output(
        json.dumps({
            "question_text": "Can you describe a distributed system you designed?",
            "reasoning": "Follow-up on distributed systems experience.",
            "difficulty_level": 2,
        }),
        set(),
    )
    assert result is not None, f"Clean JSON should be accepted, got: {result}"
    question, reasoning = result
    assert question == "Can you describe a distributed system you designed?"
    assert reasoning == "Follow-up on distributed systems experience."


@pytest.mark.asyncio
async def test_parse_llm_output_accepts_plain_text_fallback():
    """Plain text without JSON or schema keys should be accepted (legacy providers)."""
    coordinator = PromptChainCoordinator.__new__(PromptChainCoordinator)

    result = coordinator._parse_llm_output(
        "Can you share a specific example from your experience?",
        set(),
    )
    assert result is not None, f"Plain text should be accepted, got: {result}"
    question, reasoning = result
    assert question == "Can you share a specific example from your experience?"
    assert reasoning == ""
