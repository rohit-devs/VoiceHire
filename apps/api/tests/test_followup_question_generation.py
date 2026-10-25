"""Regression test for follow-up question generation with the real provider chain.

Wires the REAL chain:
    PromptChainCoordinator -> LegacyProviderAdapter -> FallbackProvider -> OllamaProvider

Only the HTTP layer is stubbed via httpx.MockTransport. The real provider classes
and the real coordinator are used.

Before the fix, this raised:
    TypeError: FallbackProvider.complete() got an unexpected keyword argument 'purpose'

After the fix, generate_next_question succeeds and returns a question from Ollama.
"""
from __future__ import annotations

import json
import os

import httpx
import pytest

from app.providers.legacy_adapter import LegacyProviderAdapter
from app.interview.prompt_chaining import (
    PromptChainCoordinator,
    QuestionGenerationRequest,
)
from app.interview.provider_fallback import FallbackProvider


def _ollama_handler(request: httpx.Request) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "message": {
                "content": json.dumps(
                    {
                        "question_text": "What is your experience with Python?",
                        "reasoning": "Follow-up question based on your answer.",
                        "difficulty_level": 2,
                    }
                )
            }
        },
    )


@pytest.mark.asyncio
async def test_followup_generation_real_chain_succeeds_with_ollama(
    monkeypatch,
):
    os.environ["LLM_PROVIDER"] = "ollama"

    # Stub only the HTTP layer: Ollama's /api/chat returns valid JSON.
    mock_transport = httpx.MockTransport(_ollama_handler)
    original_init = httpx.AsyncClient.__init__

    def patched_init(self, *args, **kwargs):
        kwargs["transport"] = mock_transport
        original_init(self, *args, **kwargs)

    monkeypatch.setattr("httpx.AsyncClient.__init__", patched_init)

    # Wire the REAL chain (no fakes, no mocks at provider level).
    fallback = FallbackProvider()
    adapter = LegacyProviderAdapter(fallback)
    coordinator = PromptChainCoordinator(adapter)

    request = QuestionGenerationRequest(
        session_id="session-1",
        current_state="interviewing",
        difficulty_level=2,
        blueprint={
            "target_role": "Senior Backend Engineer",
            "interview_focus_areas": ["backend"],
            "resume_text": "5 years Python backend experience.",
            "job_description_text": "Backend role.",
        },
        conversation=[
            {"speaker": "interviewer", "text": "Tell me about yourself."},
            {
                "speaker": "candidate",
                "text": "I have 5 years of Python backend experience.",
            },
        ],
        elapsed_seconds=0,
        question_budget=5,
        is_opener=False,
    )

    result = await coordinator.generate_next_question(request)

    assert result.question_text == "What is your experience with Python?"
    assert result.reasoning == "Follow-up question based on your answer."
    assert result.difficulty_level == 2
    assert result.degraded is False
