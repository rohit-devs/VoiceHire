"""Safe question-generation pipeline with strict system/user prompt separation."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field

from app.interview.llm_provider import LLMProvider

logger = logging.getLogger(__name__)
MAX_INPUT_CHARS = 8_000
MAX_OUTPUT_TOKENS = 350


class QuestionGenerationRequest(BaseModel):
    session_id: str
    current_state: str
    difficulty_level: int = Field(ge=1, le=3)
    blueprint: dict[str, Any]
    conversation: list[dict[str, str]]
    elapsed_seconds: int
    question_budget: int


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
    def __init__(self, provider: LLMProvider, yaml_prompt_path: str | None = None) -> None:
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
        payload = {
            "task": "Generate exactly one next interviewer question.",
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
        completion = await self.provider.complete(
            session_id=request.session_id,
            system_prompt=self.system_prompt,
            user_content=conversation_text,
            max_tokens=MAX_OUTPUT_TOKENS,
        )
        question = completion.text.strip().strip('"')
        prior_questions = {
            self._normalize(item["text"])
            for item in request.conversation
            if item["speaker"] == "interviewer"
        }
        if self._normalize(question) in prior_questions or "reasoning:" in question.lower():
            question = (
                "Considering the example you just shared, what alternative approach "
                "would you consider for this role?"
            )
            if self._normalize(question) in prior_questions:
                question = (
                    "What is one different lesson from your experience that applies "
                    "to this role?"
                )
        if not question.endswith("?"):
            question = question.rstrip(".!") + "?"
        if question.count("?") > 1:
            question = question[: question.index("?") + 1]
        if len(question.split()) > 60:
            question = " ".join(question.split()[:60])
            if not question.endswith("?"):
                question = question.rstrip(".,!") + "?"
        if not question:
            raise ValueError("Question generation returned empty content")
        return GeneratedQuestion(
            session_id=request.session_id,
            question_text=question,
            state=request.current_state,
            difficulty_level=request.difficulty_level,
            reasoning="Generated from the persisted interview blueprint and conversation.",
            prompt_tokens=completion.prompt_tokens,
            completion_tokens=completion.completion_tokens,
            timestamp=datetime.now(timezone.utc),
        )

    @staticmethod
    def _normalize(text: str) -> str:
        return " ".join("".join(char.lower() if char.isalnum() else " " for char in text).split())
