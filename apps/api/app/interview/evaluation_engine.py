"""Schema-validated, evidence-grounded interview evaluation."""

from __future__ import annotations

import json
import logging
import math
import re
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field, StrictInt, ValidationError

from app.interview.llm_provider import LLMProvider
from app.interview.voice_metrics import calculate_voice_metrics
from app.models import InterviewSession, Transcript

logger = logging.getLogger(__name__)

RUBRIC_PATH = Path(__file__).resolve().parents[4] / "packages" / "prompts" / "evaluator.yaml"
MAX_EVALUATION_OUTPUT_TOKENS = 2600
MAX_EVALUATION_INPUT_TOKENS = 12_000
MAX_CONTEXT_CHARS = 4000
MAX_ANSWER_CHARS = 6000
MAX_QUESTION_CHARS = 2000

FORBIDDEN_INFERENCE = re.compile(
    r"\b("
    r"personality|gender|race|ethnicity|age|disab(?:ility|led)|health|medical|"
    r"religion|sexual orientation|pregnan\w*|nationality|neurodivergen\w*|"
    r"emotional state|emotion|confidence|confident|nervous|anxious|accent"
    r")\b",
    re.IGNORECASE,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CategoryAssessment(StrictModel):
    score: StrictInt = Field(ge=0, le=5)
    rationale: str = Field(min_length=1, max_length=1200)


class QuestionAssessment(StrictModel):
    question_id: str = Field(min_length=1, max_length=36)
    question: str = Field(min_length=1, max_length=MAX_QUESTION_CHARS)
    evidence_quote: str = Field(min_length=1, max_length=500)
    rationale: str = Field(min_length=1, max_length=1200)
    category_scores: dict[str, StrictInt]


class PracticeExercise(StrictModel):
    category: str
    title: str = Field(min_length=1, max_length=160)
    task: str = Field(min_length=1, max_length=1200)
    target_role: str = Field(min_length=1, max_length=100)


class EvaluationOutput(StrictModel):
    overall_score: float = Field(ge=0, le=5)
    category_scores: dict[str, CategoryAssessment]
    per_question_analysis: list[QuestionAssessment] = Field(min_length=1, max_length=40)
    strengths: list[str] = Field(min_length=1, max_length=8)
    missing_elements: list[str] = Field(min_length=1, max_length=12)
    improved_answer_structure: list[str] = Field(min_length=2, max_length=8)
    practice_exercises: list[PracticeExercise] = Field(min_length=7, max_length=7)


class EvaluationOutputError(ValueError):
    """The provider response is not safe or valid against the evaluation contract."""


def load_rubric(weights_override: str | None = None) -> dict[str, Any]:
    """Load the versioned rubric and apply validated configurable weights."""
    document = yaml.safe_load(RUBRIC_PATH.read_text(encoding="utf-8"))
    categories = document["categories"]
    weights = {name: float(value) for name, value in document["weights"].items()}
    if weights_override:
        configured = json.loads(weights_override)
        if not isinstance(configured, dict) or set(configured) != set(categories):
            raise ValueError("Evaluation weight configuration must name every rubric category")
        weights = {name: float(configured[name]) for name in categories}
    if set(weights) != set(categories) or any(
        not math.isfinite(value) or value < 0 for value in weights.values()
    ):
        raise ValueError("Evaluation rubric weights are invalid")
    total = sum(weights.values())
    if total <= 0:
        raise ValueError("At least one evaluation rubric weight must be positive")
    document["weights"] = {name: value / total for name, value in weights.items()}
    return document


def _question_answer_pairs(transcripts: list[Transcript]) -> list[dict[str, str]]:
    current_question: Transcript | None = None
    pairs: list[dict[str, str]] = []
    for row in sorted(transcripts, key=lambda transcript: transcript.id):
        if row.speaker == "interviewer":
            current_question = row
        elif row.speaker == "candidate" and row.message.strip() and current_question:
            question_number = len(pairs) + 1
            pairs.append(
                {
                    "question_id": str(question_number),
                    "answer_id": str(row.id),
                    "question": current_question.message[:MAX_QUESTION_CHARS],
                    "answer": row.message[:MAX_ANSWER_CHARS],
                }
            )
            current_question = None
    return pairs


def has_evaluation_pairs(transcripts: list[Transcript]) -> bool:
    return bool(_question_answer_pairs(transcripts))


def measured_evidence(
    session: InterviewSession, transcripts: list[Transcript]
) -> dict[str, Any]:
    candidate_rows = [row for row in transcripts if row.speaker == "candidate"]
    voice = calculate_voice_metrics(
        [
            {
                "speaker": row.speaker,
                "message": row.message,
                "language": row.language,
                "timestamp_ms": row.timestamp_ms,
                "duration_ms": row.duration_ms,
            }
            for row in candidate_rows
        ],
        started_at=session.started_at,
        duration_seconds=session.requested_duration_seconds,
        now=session.ended_at,
    )
    pairs = _question_answer_pairs(transcripts)
    answer_lengths = [
        {
            "question_id": pair["question_id"],
            "words": len(re.findall(r"[^\W_]+(?:['’][^\W_]+)?", pair["answer"])),
        }
        for pair in pairs
    ]
    voice["questions_answered"] = {
        "value": len(pairs),
        "unit": "questions",
        "reason": None,
    }
    voice["answer_lengths_by_question"] = {
        "value": answer_lengths if answer_lengths else None,
        "unit": "words",
        "reason": None if answer_lengths else "No finalized candidate answers are available.",
    }
    return voice


def _system_prompt(rubric: dict[str, Any]) -> str:
    rubric_contract = {
        "version": rubric["version"],
        "weights": rubric["weights"],
        "scale": rubric["scale"],
        "categories": rubric["categories"],
    }
    return (
        rubric["system_prompt"]
        + "\n\nRUBRIC CONTRACT (trusted configuration):\n"
        + json.dumps(rubric_contract, ensure_ascii=False)
    )


def _validate_output(
    raw: str,
    *,
    rubric: dict[str, Any],
    pairs: list[dict[str, str]],
    target_role: str,
) -> EvaluationOutput:
    try:
        parsed = EvaluationOutput.model_validate_json(raw)
    except (ValidationError, ValueError) as exc:
        raise EvaluationOutputError("Provider output did not match the evaluation schema") from exc

    categories = rubric["categories"]
    if set(parsed.category_scores) != set(categories):
        raise EvaluationOutputError("Provider output omitted or added rubric categories")
    expected_ids = {pair["question_id"] for pair in pairs}
    question_ids = [item.question_id for item in parsed.per_question_analysis]
    if len(question_ids) != len(expected_ids) or set(question_ids) != expected_ids:
        raise EvaluationOutputError("Provider output does not analyze every answered question once")
    answer_by_question = {pair["question_id"]: pair["answer"] for pair in pairs}
    for item in parsed.per_question_analysis:
        if item.question != next(
            pair["question"] for pair in pairs if pair["question_id"] == item.question_id
        ):
            raise EvaluationOutputError("Provider changed a transcript question")
        if item.evidence_quote not in answer_by_question[item.question_id]:
            raise EvaluationOutputError("Provider evidence quote is not an exact answer excerpt")
        if set(item.category_scores) != set(categories) or any(
            score < 0 or score > 5 for score in item.category_scores.values()
        ):
            raise EvaluationOutputError("Per-question category scores are invalid")
    if any(item.target_role != target_role for item in parsed.practice_exercises):
        raise EvaluationOutputError("Practice exercises must match the session target role")
    if any(item.category not in categories for item in parsed.practice_exercises):
        raise EvaluationOutputError("Practice exercise uses an unknown rubric category")

    weak_categories = {
        name
        for name, assessment in sorted(
            parsed.category_scores.items(), key=lambda item: item[1].score
        )[:3]
    }
    if any(item.category not in weak_categories for item in parsed.practice_exercises):
        raise EvaluationOutputError("Practice exercises must target the weakest categories")

    weighted_score = sum(
        parsed.category_scores[name].score * rubric["weights"][name] for name in categories
    )
    if abs(parsed.overall_score - round(weighted_score, 2)) > 0.01:
        raise EvaluationOutputError("Overall score does not match the configured weighted rubric")

    narrative_fields = [
        assessment.rationale for assessment in parsed.category_scores.values()
    ] + [
        item.rationale for item in parsed.per_question_analysis
    ] + parsed.strengths + parsed.missing_elements + parsed.improved_answer_structure
    narrative_fields.extend(
        text
        for exercise in parsed.practice_exercises
        for text in (exercise.title, exercise.task)
    )
    if any(FORBIDDEN_INFERENCE.search(text) for text in narrative_fields):
        raise EvaluationOutputError("Provider output included a prohibited personal inference")
    return parsed


async def generate_assessment(
    *,
    session_id: str,
    session: InterviewSession,
    transcripts: list[Transcript],
    context: dict[str, str],
    provider: LLMProvider,
    weights_override: str | None = None,
) -> dict[str, Any]:
    rubric = load_rubric(weights_override)
    metrics = measured_evidence(session, transcripts)
    pairs = _question_answer_pairs(transcripts)
    if not pairs:
        return {
            "status": "insufficient_data",
            "rubric_version": rubric["version"],
            "measured_metrics": metrics,
            "ai_assessments": None,
            "error": "No finalized question-and-answer pairs are available for evaluation.",
            "tokens_used": 0,
        }

    bounded_context = {
        "target_role": session.role,
        "resume": context.get("resume", "")[:MAX_CONTEXT_CHARS],
        "job_description": context.get("job_description", "")[:MAX_CONTEXT_CHARS],
    }
    payload = {
        "task": "Evaluate every supplied question-answer pair against the rubric.",
        "target_role": session.role,
        "rubric_version": rubric["version"],
        "evaluation_context": bounded_context,
        "evaluation_items": [
            {
                "question_id": pair["question_id"],
                "question": pair["question"],
                "candidate_answer": pair["answer"],
                "context": bounded_context,
            }
            for pair in pairs
        ],
        "required_output_schema": EvaluationOutput.model_json_schema(),
    }
    user_content = json.dumps(payload, ensure_ascii=False)
    estimated_input = (len(_system_prompt(rubric)) + len(user_content) + 3) // 4
    if estimated_input + 2 * MAX_EVALUATION_OUTPUT_TOKENS > MAX_EVALUATION_INPUT_TOKENS:
        raise EvaluationOutputError(
            "The session transcript exceeds the evaluation token budget; no evaluation was generated."
        )

    tokens_used = 0
    last_error: EvaluationOutputError | None = None
    for attempt in range(2):
        completion = await provider.complete(
            session_id=session_id,
            system_prompt=_system_prompt(rubric),
            user_content=user_content,
            max_tokens=MAX_EVALUATION_OUTPUT_TOKENS,
        )
        tokens_used += completion.prompt_tokens + completion.completion_tokens
        try:
            output = _validate_output(
                completion.text,
                rubric=rubric,
                pairs=pairs,
                target_role=session.role,
            )
            return {
                "status": "completed",
                "rubric_version": rubric["version"],
                "measured_metrics": metrics,
                "ai_assessments": output.model_dump(mode="json"),
                "provider": completion.provider or type(provider).__name__.lower(),
                "model": completion.model or getattr(provider, "model", "unknown"),
                "error": None,
                "tokens_used": tokens_used,
            }
        except EvaluationOutputError as exc:
            last_error = exc
            if attempt == 0:
                user_content += (
                    "\n\nThe prior response was invalid. Return a corrected JSON object "
                    "matching the exact required schema and validation rules."
                )
                continue
            break
    output_size = len(completion.text) if completion else 0
    logger.warning(
        "Evaluation failed for session_id=%s provider=%s output_size=%d error=%s",
        session_id,
        getattr(provider, "name", "unknown"),
        output_size,
        last_error,
    )
    return {
        "status": "failed",
        "rubric_version": rubric["version"],
        "measured_metrics": metrics,
        "ai_assessments": None,
        "error": str(last_error or "Evaluation output could not be validated."),
        "tokens_used": tokens_used,
    }