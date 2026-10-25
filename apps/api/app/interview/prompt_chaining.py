"""Safe question-generation pipeline with strict system/user prompt separation.

The coordinator asks the LLM to return JSON matching GeneratedQuestionPayload,
validates it with Pydantic, applies similarity-based dedup with bounded
regeneration attempts, and falls back to a vetted question bank when the LLM
cannot produce a usable question.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import yaml
from pydantic import BaseModel, Field, ValidationError

from app.interview.llm_provider import Completion, LLMProvider, LLMUnavailable
from app.interview.question_bank import BankQuestion, get_bank_question, get_opener

logger = logging.getLogger(__name__)
MAX_INPUT_CHARS = 8_000
MAX_OUTPUT_TOKENS = 350
MAX_REGENERATION_ATTEMPTS = 3
SIMILARITY_THRESHOLD = 0.85


class QuestionGenerationRequest(BaseModel):
    session_id: str
    current_state: str
    difficulty_level: int = Field(ge=1, le=3)
    blueprint: dict[str, Any]
    conversation: list[dict[str, str]]
    elapsed_seconds: int
    question_budget: int
    is_opener: bool = False


class GeneratedQuestionPayload(BaseModel):
    """JSON schema the LLM must return for question generation."""

    question_text: str = Field(min_length=1, max_length=200)
    reasoning: str = Field(max_length=500)
    difficulty_level: int = Field(ge=1, le=3)


class GeneratedQuestion(BaseModel):
    session_id: str
    question_text: str
    state: str
    difficulty_level: int
    reasoning: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    prompt_tokens: int = 0
    completion_tokens: int = 0
    degraded: bool = False


class PromptChainCoordinator:
    def __init__(
        self,
        provider: LLMProvider,
        yaml_prompt_path: str | None = None,
    ) -> None:
        self.provider = provider
        prompt_path = (
            Path(yaml_prompt_path)
            if yaml_prompt_path
            else Path(__file__).resolve().parents[4] / "packages" / "prompts" / "interviewer.yaml"
        )
        prompt_data = yaml.safe_load(prompt_path.read_text(encoding="utf-8"))
        if prompt_data.get("version") != 2 or not prompt_data.get("system_prompt"):
            raise ValueError("Unsupported or empty interviewer system prompt")
        self.system_prompt = prompt_data["system_prompt"].strip()

    async def generate_next_question(
        self, request: QuestionGenerationRequest
    ) -> GeneratedQuestion:
        # ── Fixed opener: always "Tell me about yourself." ──────────────
        if request.is_opener:
            opener = get_opener()
            return GeneratedQuestion(
                session_id=request.session_id,
                question_text=opener.text,
                state=request.current_state,
                difficulty_level=opener.difficulty,
                reasoning="Fixed opening question.",
                prompt_tokens=0,
                completion_tokens=0,
                degraded=False,
            )

        # ── Build LLM payload ───────────────────────────────────────────
        payload = {
            "task": "Generate exactly one next interviewer question.",
            "format": "json",
            "schema": {
                "question_text": "string (1-200 chars)",
                "reasoning": "string (max 500 chars)",
                "difficulty_level": "integer (1-3)",
            },
            "blueprint": {
                **request.blueprint,
                "resume_text": str(request.blueprint.get("resume_text", ""))[:2500],
                "job_description_text": str(
                    request.blueprint.get("job_description_text", "")
                )[:2500],
            },
            "conversation": [
                {"speaker": item["speaker"], "text": item["text"][:1200]}
                for item in request.conversation[-20:]
            ],
            "current_state": request.current_state,
            "difficulty_level": request.difficulty_level,
            "elapsed_seconds": request.elapsed_seconds,
            "question_budget": request.question_budget,
        }
        conversation_text = json.dumps(payload, ensure_ascii=False)
        while len(conversation_text) > MAX_INPUT_CHARS and payload["conversation"]:
            payload["conversation"].pop(0)
            conversation_text = json.dumps(payload, ensure_ascii=False)
        if len(conversation_text) > MAX_INPUT_CHARS:
            payload["blueprint"]["resume_text"] = payload["blueprint"]["resume_text"][:1000]
            payload["blueprint"]["job_description_text"] = payload["blueprint"][
                "job_description_text"
            ][:1000]
            conversation_text = json.dumps(payload, ensure_ascii=False)
        if len(conversation_text) > MAX_INPUT_CHARS:
            raise ValueError("Bounded interview context exceeds the provider input limit")

        # ── Prior questions for dedup ───────────────────────────────────
        prior_questions = {
            self._normalize(item["text"])
            for item in request.conversation
            if item["speaker"] == "interviewer"
        }

        # ── Try LLM with JSON schema, bounded regeneration ──────────────
        last_error: Optional[Exception] = None
        for attempt in range(MAX_REGENERATION_ATTEMPTS):
            try:
                completion = await self.provider.complete(
                    session_id=request.session_id,
                    system_prompt=self.system_prompt,
                    user_content=conversation_text,
                    max_tokens=MAX_OUTPUT_TOKENS,
                )
                parsed = self._parse_llm_output(completion.text, prior_questions)
                if parsed is not None:
                    question_text, llm_reasoning = parsed
                    return GeneratedQuestion(
                        session_id=request.session_id,
                        question_text=question_text,
                        state=request.current_state,
                        difficulty_level=request.difficulty_level,
                        reasoning=llm_reasoning or f"Generated by {completion.provider} ({completion.model}).",
                        prompt_tokens=completion.prompt_tokens,
                        completion_tokens=completion.completion_tokens,
                        degraded=False,
                    )
                last_error = ValueError("LLM output failed validation or dedup")
            except (LLMUnavailable, ValidationError, ValueError, json.JSONDecodeError) as exc:
                last_error = exc
                logger.warning(
                    "Question generation attempt %d/%d failed: %s",
                    attempt + 1,
                    MAX_REGENERATION_ATTEMPTS,
                    exc,
                )

        # ── Question bank fallback ──────────────────────────────────────
        category = self._pick_category(request.current_state, request.conversation)
        bank_q = get_bank_question(
            category=category,
            difficulty=request.difficulty_level,
            exclude=prior_questions,
        )
        if bank_q is not None:
            logger.warning(
                "Falling back to question bank after %d failed LLM attempts",
                MAX_REGENERATION_ATTEMPTS,
            )
            return GeneratedQuestion(
                session_id=request.session_id,
                question_text=bank_q.text,
                state=request.current_state,
                difficulty_level=bank_q.difficulty,
                reasoning=f"Question bank fallback (category={category}, builds_on={bank_q.builds_on}).",
                prompt_tokens=0,
                completion_tokens=0,
                degraded=True,
            )

        # ── Last resort: safe templated question ────────────────────────
        fallback = self._safe_fallback(prior_questions)
        return GeneratedQuestion(
            session_id=request.session_id,
            question_text=fallback,
            state=request.current_state,
            difficulty_level=request.difficulty_level,
            reasoning="Safe fallback after LLM and question bank both unavailable.",
            prompt_tokens=0,
            completion_tokens=0,
            degraded=True,
        )

    # ── Internal helpers ────────────────────────────────────────────────

    def _parse_llm_output(
        self, text: str, prior_questions: set[str]
    ) -> Optional[tuple[str, str]]:
        """Parse LLM output as JSON, validate, dedup, sanitize.

        Returns (question_text, reasoning) or None on failure.
        Accepts both JSON (preferred) and plain text output from legacy providers.
        """
        text = text.strip()
        question: Optional[str] = None
        reasoning: Optional[str] = None

        # Try JSON first
        try:
            data = json.loads(text)
            payload = GeneratedQuestionPayload.model_validate(data)
            question = payload.question_text.strip()
            reasoning = payload.reasoning.strip()
        except (json.JSONDecodeError, ValidationError):
            # Fall back to plain text from legacy providers
            question = text.strip().strip('"')
            reasoning = None

        if not question:
            return None

        # Dedup: exact and similarity
        normalized = self._normalize(question)
        if normalized in prior_questions:
            return None
        for prior in prior_questions:
            if self._similarity(normalized, prior) >= SIMILARITY_THRESHOLD:
                return None

        # Sanitize: ensure ends with ?, single question mark, max 60 words
        if not question.endswith("?"):
            question = question.rstrip(".!") + "?"
        if question.count("?") > 1:
            question = question[: question.index("?") + 1]
        if len(question.split()) > 60:
            question = " ".join(question.split()[:60])
            if not question.endswith("?"):
                question = question.rstrip(".,!") + "?"

        return question or None, reasoning or ""

    @staticmethod
    def _similarity(a: str, b: str) -> float:
        """Simple Jaccard similarity on word sets."""
        words_a = set(a.split())
        words_b = set(b.split())
        if not words_a or not words_b:
            return 0.0
        intersection = words_a & words_b
        union = words_a | words_b
        return len(intersection) / len(union)

    @staticmethod
    def _pick_category(current_state: str, conversation: list[dict[str, str]]) -> str:
        """Pick a question-bank category based on interview state."""
        state_lower = current_state.lower()
        if "technical" in state_lower:
            return "jd_technical"
        if "behavioral" in state_lower:
            return "jd_behavioral"
        if "resume" in state_lower or "project" in state_lower:
            return "resume"
        # Count candidate answers to decide intro vs general
        candidate_answers = [
            item for item in conversation if item["speaker"] == "candidate"
        ]
        if len(candidate_answers) <= 1:
            return "resume"
        return "general"

    @staticmethod
    def _safe_fallback(prior_questions: set[str]) -> str:
        """Return a safe templated question not in prior_questions."""
        templates = [
            "Can you share a specific example from your experience?",
            "What would you do differently if you faced that situation again?",
            "How does your background prepare you for this role?",
            "Is there anything else you'd like to share about your experience?",
        ]
        for t in templates:
            if PromptChainCoordinator._normalize(t) not in prior_questions:
                return t
        # All templates exhausted -- return the last one (still better than empty)
        return templates[-1]

    @staticmethod
    def _normalize(text: str) -> str:
        return " ".join("".join(char.lower() if char.isalnum() else " " for char in text).split())
