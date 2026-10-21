"""Bounded LLM provider implementations used by interviewer question generation."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from typing import Protocol

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class LLMUnavailable(RuntimeError):
    """Raised after bounded provider retries are exhausted."""


@dataclass(frozen=True)
class Completion:
    text: str
    prompt_tokens: int
    completion_tokens: int
    provider: str = ""
    model: str = ""


class LLMProvider(Protocol):
    async def complete(
        self, *, session_id: str, system_prompt: str, user_content: str, max_tokens: int
    ) -> Completion: ...


def create_groq_client() -> AsyncOpenAI:
    """Build the shared OpenAI-compatible client for Groq-backed legacy helpers."""
    return AsyncOpenAI(
        api_key=settings.GROQ_API_KEY,
        base_url=settings.GROQ_BASE_URL,
        timeout=15.0,
        max_retries=0,
    )


class GroqProvider:
    """OpenAI-compatible Groq provider with one bounded retry."""

    def __init__(
        self,
        api_key: str,
        *,
        model: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self.model = model or settings.GROQ_FAST_MODEL
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url or settings.GROQ_BASE_URL,
            timeout=15.0,
            max_retries=0,
        )

    async def complete(
        self, *, session_id: str, system_prompt: str, user_content: str, max_tokens: int
    ) -> Completion:
        for attempt in range(2):
            try:
                response = await asyncio.wait_for(
                    self.client.chat.completions.create(
                        model=self.model,
                        temperature=0.3,
                        max_tokens=max_tokens,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_content},
                        ],
                    ),
                    timeout=18.0,
                )
                usage = response.usage
                completion = Completion(
                    text=(response.choices[0].message.content or "").strip(),
                    prompt_tokens=usage.prompt_tokens if usage else 0,
                    completion_tokens=usage.completion_tokens if usage else 0,
                    provider="groq",
                    model=self.model,
                )
                logger.info(
                    "LLM completion provider=groq model=%s session_id=%s prompt_tokens=%d completion_tokens=%d",
                    self.model,
                    session_id,
                    completion.prompt_tokens,
                    completion.completion_tokens,
                )
                if completion.text:
                    return completion
                raise LLMUnavailable("Groq returned an empty response.")
            except LLMUnavailable:
                raise
            except Exception as exc:
                logger.warning(
                    "Groq request failed session_id=%s attempt=%d error_type=%s",
                    session_id,
                    attempt + 1,
                    type(exc).__name__,
                )
                if attempt == 0:
                    await asyncio.sleep(0.5)
                    continue
                if getattr(exc, "status_code", None) == 429 or any(
                    marker in str(exc).lower() for marker in ("quota", "rate limit", "rate_limit")
                ):
                    raise LLMUnavailable(
                        "Groq's free-tier limit was reached. Try text input again later or start a demo interview."
                    ) from exc
                raise LLMUnavailable(
                    "Groq is temporarily unavailable. Continue with text input or start a demo interview."
                ) from exc
        raise LLMUnavailable("Groq is temporarily unavailable.")


class FakeProvider:
    """Deterministic provider for tests and explicitly flagged demo sessions only."""

    _INJECTION = re.compile(
        r"\b(ignore|disregard|override)\b.{0,80}\b(instructions?|rules?|system|prompt)\b",
        re.IGNORECASE,
    )

    async def complete(
        self, *, session_id: str, system_prompt: str, user_content: str, max_tokens: int
    ) -> Completion:
        payload = json.loads(user_content)
        conversation = payload["conversation"]
        answers = [item["text"] for item in conversation if item["speaker"] == "candidate"]
        previous_questions = {
            self._normalize(item["text"])
            for item in conversation
            if item["speaker"] == "interviewer"
        }
        blueprint = payload["blueprint"]
        role = blueprint["target_role"]
        focus = blueprint.get("interview_focus_areas") or [role]

        if not answers:
            question = f"To start, how does your experience prepare you for the {role} role?"
        else:
            answer = answers[-1].strip()
            normalized_answer = self._normalize(answer)
            if self._INJECTION.search(answer):
                question = f"Let's focus on your experience for the {role} role. What relevant example would you like to discuss?"
            elif normalized_answer in {
                "i don t know",
                "i do not know",
                "not sure",
                "no idea",
            }:
                question = "That's okay. What part of the problem would you explore first, and why?"
            elif len(answer.split()) < 8:
                question = "Thanks for sharing that. Could you expand with one specific example from your experience?"
            elif len(answer.split()) < 25:
                quote = " ".join(answer.split()[:10]).rstrip(".,!?;:")
                question = f"You mentioned “{quote}.” What trade-off did you consider when you took that approach?"
            else:
                area = focus[min(len(answers) - 1, len(focus) - 1)]
                question = f"From the example you described, what would you change to improve your approach to {area}?"

        if self._normalize(question) in previous_questions:
            question = f"Considering your resume and the {role} role, what is one outcome from your experience you can quantify?"
        if self._normalize(question) in previous_questions:
            question = f"What is one important lesson from your experience relevant to {role}?"

        return Completion(
            text=question,
            prompt_tokens=0,
            completion_tokens=0,
            provider="demo",
            model="mock",
        )

    @staticmethod
    def _normalize(text: str) -> str:
        return " ".join(re.findall(r"\w+", text.lower()))
