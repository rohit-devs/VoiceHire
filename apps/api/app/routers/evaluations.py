"""Interview evaluation, measured analytics, and coaching-plan endpoints."""

import json
import logging
import math
import re
from copy import deepcopy
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.interview.evaluation_engine import (
    MAX_EVALUATION_OUTPUT_TOKENS,
    EvaluationOutputError,
    generate_assessment,
    has_evaluation_pairs,
    load_rubric,
    measured_evidence,
    _question_answer_pairs,
)
from app.interview.llm_provider import LLMProvider, LLMUnavailable
from app.providers import ProviderError, get_llm_provider
from app.providers.legacy_adapter import LegacyProviderAdapter
from app.interview.token_budget import (
    TokenBudgetExceeded,
    reconcile_tokens,
    reserve_tokens,
)
from app.interview.voice_metrics import calculate_voice_metrics
from app.models import (
    CandidateProfile,
    CoachingPlan,
    EvaluationReport,
    InterviewSession,
    Transcript,
)

logger = logging.getLogger(__name__)

GUIDANCE_NOTE = "AI scores are guidance for practice, not proof of competence."
DEMO_GUIDANCE_NOTE = "Demo scores are heuristic simulations, not AI-generated assessments."

router = APIRouter()


def _evaluation_provider() -> LLMProvider:
    provider = get_llm_provider()
    if provider.simulated:
        raise ProviderError("The evaluation provider is disabled for real reports.")
    return LegacyProviderAdapter(provider, purpose="report")


def _generate_demo_evaluation(
    session: InterviewSession, transcripts: list[Transcript], plan_length: int = 7
) -> dict[str, Any]:
    """Generate a clearly-labeled deterministic demo evaluation without an LLM.

    Uses simple heuristics (answer length, specific examples, measurable outcomes)
    and is never described as AI-generated or provider-verified.
    """
    rubric = load_rubric()
    metrics = measured_evidence(session, transcripts)
    pairs = _question_answer_pairs(transcripts)

    if not pairs:
        return {
            "status": "insufficient_data",
            "rubric_version": rubric["version"],
            "measured_metrics": metrics,
            "ai_assessments": {
                "_provider": "demo",
                "_model": "simulated",
                "_guidance_note": DEMO_GUIDANCE_NOTE,
            },
            "provider": "demo",
            "model": "simulated",
            "error": "No finalized question-and-answer pairs are available for evaluation.",
            "tokens_used": 0,
        }

    categories = list(rubric["categories"].keys())
    per_question: list[dict[str, Any]] = []
    all_scores: dict[str, list[int]] = {name: [] for name in categories}

    example_terms = re.compile(
        r"\b(built|led|created|developed|implemented|designed|launched|owned|delivered)\b",
        re.IGNORECASE,
    )
    metric_terms = re.compile(
        r"\b\d+(?:\.\d+)?\s*(%|percent|ms|seconds?|minutes?|hours?|days?|x|times?)\b",
        re.IGNORECASE,
    )
    outcome_terms = re.compile(
        r"\b(reduced|increased|improved|decreased|saved|achieved|resulted|cut)\b",
        re.IGNORECASE,
    )

    for pair in pairs:
        answer = pair["answer"]
        words = len(re.findall(r"[^\W_]+(?:['’][^\W_]+)?", answer))
        has_example = bool(example_terms.search(answer))
        has_metric = bool(metric_terms.search(answer))
        has_outcome = bool(outcome_terms.search(answer))

        base_score = min(5, max(1, words // 10))
        if has_example:
            base_score = min(5, base_score + 1)
        if has_metric:
            base_score = min(5, base_score + 1)
        if has_outcome:
            base_score = min(5, base_score + 1)

        scores: dict[str, int] = {}
        for name in categories:
            variation = {
                "technical_correctness": 0,
                "relevance": 0,
                "structure_and_clarity": 1,
                "completeness_and_examples": -1 if not has_example else 0,
                "problem_solving": 0,
                "communication": 1 if has_outcome else 0,
                "job_skill_alignment": 0,
            }.get(name, 0)
            score = max(0, min(5, base_score + variation))
            scores[name] = score
            all_scores[name].append(score)

        evidence = answer[:50] if answer else "No answer provided."
        per_question.append(
            {
                "question_id": pair["question_id"],
                "question": pair["question"],
                "evidence_quote": evidence,
                "rationale": "Demo heuristic score based on answer length, specific examples, and measurable outcomes.",
                "category_scores": scores,
            }
        )

    category_scores: dict[str, dict[str, Any]] = {}
    for name in categories:
        avg = sum(all_scores[name]) / len(all_scores[name]) if all_scores[name] else 0
        rounded = max(0, min(5, round(avg)))
        category_scores[name] = {
            "score": rounded,
            "rationale": "Demo heuristic aggregate across all answers.",
        }

    weighted = sum(
        category_scores[name]["score"] * rubric["weights"][name] for name in categories
    )
    overall_score = round(weighted, 2)

    weakest = sorted(categories, key=lambda n: category_scores[n]["score"])[:3]

    strengths = ["Completed all interview questions."]
    missing_elements = ["More specific examples with measurable outcomes."]
    improved_structure = [
        "State the problem and constraints.",
        "Explain the approach and trade-offs.",
        "Conclude with a measured result.",
    ]

    practice_exercises: list[dict[str, Any]] = []
    for i, category in enumerate(weakest):
        practice_exercises.append(
            {
                "category": category,
                "title": f"Practice task {i + 1}",
                "task": f"Prepare a specific example for {category.replace('_', ' ')} with a measurable result.",
                "target_role": session.role,
            }
        )
    while len(practice_exercises) < 7:
        practice_exercises.append(
            {
                "category": weakest[len(practice_exercises) % len(weakest)],
                "title": f"Practice task {len(practice_exercises) + 1}",
                "task": "Outline an answer for a relevant interview question.",
                "target_role": session.role,
            }
        )

    ai_assessments: dict[str, Any] = {
        "overall_score": overall_score,
        "category_scores": category_scores,
        "per_question_analysis": per_question,
        "strengths": strengths,
        "missing_elements": missing_elements,
        "improved_answer_structure": improved_structure,
        "practice_exercises": practice_exercises,
        "_provider": "demo",
        "_model": "simulated",
        "_guidance_note": DEMO_GUIDANCE_NOTE,
    }

    return {
        "status": "completed",
        "rubric_version": rubric["version"],
        "measured_metrics": metrics,
        "ai_assessments": ai_assessments,
        "provider": "demo",
        "model": "simulated",
        "error": None,
        "tokens_used": 0,
    }


def _provider_http_exception(error: ProviderError) -> HTTPException:
    return HTTPException(
        status_code=429 if error.status == 429 else 503,
        detail={"user_message": error.user_message},
    )


async def _owned_session(
    db: AsyncSession, session_id: str, user_id: str
) -> InterviewSession:
    session = await db.get(InterviewSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied to this session")
    return session


def _report_payload(report: EvaluationReport) -> dict[str, Any]:
    assessments = report.ai_assessments or {}
    guidance = (
        assessments.get("_guidance_note")
        if isinstance(assessments, dict)
        else None
    ) or GUIDANCE_NOTE
    filtered = {key: value for key, value in assessments.items() if not key.startswith("_")}
    return {
        "id": report.id,
        "session_id": report.session_id,
        "status": report.status,
        "rubric_version": report.rubric_version,
        "measured_metrics": report.measured_metrics,
        "ai_assessments": (
            filtered if filtered else None
        ) if report.ai_assessments is not None else None,
        "provider": assessments.get("_provider"),
        "model": assessments.get("_model"),
        "error": report.error,
        "guidance_note": guidance,
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }


def _make_coaching_plan(
    report: EvaluationReport, user_id: str, role: str, assessments: dict[str, Any], plan_length: int = 7, is_demo: bool = False
) -> CoachingPlan:
    exercises = assessments["practice_exercises"]
    weakest_categories = sorted(
        assessments["category_scores"].items(),
        key=lambda item: item[1]["score"],
    )
    weakest_names = [name for name, _ in weakest_categories[:3]]

    base_days = []
    for index, exercise in enumerate(exercises, start=1):
        day_num = index
        difficulty = _difficulty_for_day(day_num, plan_length)
        base_days.append(
            {
                "day": day_num,
                "title": exercise["title"],
                "description": exercise["task"],
                "category": exercise["category"],
                "target_role": role,
                "difficulty": difficulty,
                "duration": "20 minutes",
                "completed": False,
                "type": "practice",
            }
        )

    # Spaced review days (only for 12-day plan): revisit earlier weaknesses
    # with new tasks, spaced 3+ days after the original practice.
    review_days = []
    if plan_length == 12:
        review_categories = weakest_names or [exercises[0]["category"]] if exercises else []
        for review_index in range(5):
            day_num = 8 + review_index
            category = review_categories[review_index % len(review_categories)]
            review_days.append(
                {
                    "day": day_num,
                    "title": f"Spaced review: {category}",
                    "description": f"Revisit {category} with a fresh exercise based on your earlier weaknesses. Try a different approach than your first attempt.",
                    "category": category,
                    "target_role": role,
                    "difficulty": "review",
                    "duration": "15 minutes",
                    "completed": False,
                    "type": "review",
                }
            )

    all_days = base_days + review_days

    start = date.today()
    for day_entry in all_days:
        day_entry["date"] = (start + timedelta(days=day_entry["day"] - 1)).isoformat()

    plan_data = {
        "days": all_days,
        "total_days": len(all_days),
        "target_role": role,
        "plan_length": plan_length,
        "is_demo": is_demo,
        "plan_selection_rule": (
            "7-day plan for mild weakness (<=3 weak rubric categories); "
            "12-day plan for significant weakness (>=4 weak categories) or "
            "when the user requests an extended plan. Difficulty ramps easy→medium→hard→review. "
            "Days 8-12 (12-day only) are spaced review of earlier weaknesses."
        ),
        "weakest_categories": weakest_names,
    }

    end = start + timedelta(days=len(all_days) - 1)
    return CoachingPlan(
        user_id=user_id,
        evaluation_report_id=report.id,
        plan_data=plan_data,
        start_date=start,
        end_date=end,
        completed_days=0,
        progress_notes={},
    )


def _difficulty_for_day(day_num: int, plan_length: int) -> str:
    """Difficulty ramp: easy → medium → hard → review across the plan."""
    if plan_length == 7:
        if day_num <= 2:
            return "easy"
        if day_num <= 5:
            return "medium"
        return "hard"
    # 12-day plan
    if day_num <= 3:
        return "easy"
    if day_num <= 6:
        return "medium"
    if day_num <= 9:
        return "hard"
    return "review"


async def _evaluation_context(
    db: AsyncSession, session: InterviewSession
) -> dict[str, str]:
    metadata = session.metadata_json or {}
    resume = str(metadata.get("resume_text") or "")
    if not resume and session.candidate_profile_id:
        profile = await db.get(CandidateProfile, session.candidate_profile_id)
        if profile is not None and profile.user_id == session.user_id:
            resume = json.dumps(
                profile.parsed_resume_json or {"skills": profile.skills or []},
                ensure_ascii=False,
            )
    description = str(metadata.get("job_description") or "")
    if not description and metadata.get("job_category"):
        description = f"Role category: {metadata['job_category']}"
    return {"resume": resume, "job_description": description}


@router.get("/sessions/{session_id}/report")
async def get_evaluation_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    session = await _owned_session(db, session_id, user["id"])
    report = await db.scalar(
        select(EvaluationReport).where(EvaluationReport.session_id == session_id)
    )
    if report is None:
        raise HTTPException(status_code=404, detail="Evaluation report has not been generated")
    return _report_payload(report)


@router.post("/sessions/{session_id}/report/generate")
async def generate_evaluation_report(
    session_id: str,
    plan_length: int = Query(default=7, ge=7, le=12),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    session = await _owned_session(db, session_id, user["id"])
    if session.is_demo and not settings.DEMO_MODE:
        raise HTTPException(status_code=403, detail="Simulated demo evaluations are disabled")

    existing = await db.scalar(
        select(EvaluationReport).where(EvaluationReport.session_id == session_id)
    )
    if existing is not None:
        return _report_payload(existing)
    if session.current_state != "completed":
        raise HTTPException(status_code=409, detail="Only completed sessions can be evaluated")

    if session.is_demo:
        transcripts = list(
            (
                await db.scalars(
                    select(Transcript)
                    .where(Transcript.session_id == session_id)
                    .order_by(Transcript.id)
                )
            ).all()
        )
        generated = _generate_demo_evaluation(session, transcripts, plan_length=plan_length)
        report = EvaluationReport(
            session_id=session_id,
            status=generated["status"],
            rubric_version=generated["rubric_version"],
            measured_metrics=generated["measured_metrics"],
            ai_assessments=(
                {**generated["ai_assessments"]} if generated["ai_assessments"] is not None else None
            ),
            error=generated["error"],
        )
        db.add(report)
        try:
            await db.commit()
            await db.refresh(report)
        except IntegrityError:
            await db.rollback()
            existing = await db.scalar(
                select(EvaluationReport).where(EvaluationReport.session_id == session_id)
            )
            if existing is not None:
                return _report_payload(existing)
            raise
        non_meta = (
            {k: v for k, v in generated["ai_assessments"].items() if not k.startswith("_")}
            if generated["ai_assessments"] is not None
            else {}
        )
        demo_plan_length = plan_length
        if non_meta:
            category_scores = generated["ai_assessments"].get("category_scores", {})
            weak_count = sum(
                1 for s in category_scores.values() if isinstance(s, dict) and s.get("score", 5) < 3
            )
            demo_plan_length = 12 if weak_count >= 4 else 7
        if non_meta:
            db.add(
                _make_coaching_plan(
                    report,
                    user["id"],
                    session.role,
                    generated["ai_assessments"],
                    plan_length=demo_plan_length,
                    is_demo=True,
                )
            )
            await db.commit()
        return _report_payload(report)

    rubric = load_rubric(settings.EVALUATION_RUBRIC_WEIGHTS or None)
    transcripts = list(
        (
            await db.scalars(
                select(Transcript)
                .where(Transcript.session_id == session_id)
                .order_by(Transcript.id)
            )
        ).all()
    )
    report = EvaluationReport(
        session_id=session_id,
        status="processing",
        rubric_version=rubric["version"],
        measured_metrics=measured_evidence(session, transcripts),
        ai_assessments=None,
    )
    db.add(report)
    try:
        await db.commit()
        await db.refresh(report)
    except IntegrityError:
        await db.rollback()
        existing = await db.scalar(
            select(EvaluationReport).where(EvaluationReport.session_id == session_id)
        )
        if existing is not None:
            return _report_payload(existing)
        raise

    report_id = report.id
    if not has_evaluation_pairs(transcripts):
        report.status = "insufficient_data"
        report.error = "No finalized question-and-answer pairs are available for evaluation."
        await db.commit()
        return _report_payload(report)

    transcript_chars = sum(len(row.message) for row in transcripts)
    estimated_tokens = math.ceil(
        (transcript_chars + 18_000) / 4
    ) + 2 * MAX_EVALUATION_OUTPUT_TOKENS
    tokens_reserved = False
    try:
        context = await _evaluation_context(db, session)
        provider = _evaluation_provider()
        is_local = getattr(provider, "name", None) == "ollama"
        if not is_local:
            await reserve_tokens(
                db,
                user_id=user["id"],
                session_id=session_id,
                estimated_tokens=estimated_tokens,
            )
            tokens_reserved = True
        generated = await generate_assessment(
            session_id=session_id,
            session=session,
            transcripts=transcripts,
            context=context,
            provider=provider,
            weights_override=settings.EVALUATION_RUBRIC_WEIGHTS or None,
        )
        if tokens_reserved:
            if generated["tokens_used"]:
                await reconcile_tokens(
                    db,
                    user_id=user["id"],
                    session_id=session_id,
                    reserved_tokens=estimated_tokens,
                    actual_tokens=generated["tokens_used"],
                )
            else:
                await reconcile_tokens(
                    db,
                    user_id=user["id"],
                    session_id=session_id,
                    reserved_tokens=estimated_tokens,
                    actual_tokens=0,
                )
            tokens_reserved = False
        report.status = generated["status"]
        report.rubric_version = generated["rubric_version"]
        report.measured_metrics = generated["measured_metrics"]
        report.ai_assessments = (
            {
                **generated["ai_assessments"],
                "_provider": generated["provider"],
                "_model": generated["model"],
            }
            if generated["ai_assessments"] is not None
            else None
        )
        report.error = generated["error"]
        real_plan_length = plan_length
        if generated["ai_assessments"] is not None:
            report.overall_score = generated["ai_assessments"]["overall_score"]
            category_scores = generated["ai_assessments"].get("category_scores", {})
            weak_count = sum(
                1 for s in category_scores.values() if isinstance(s, dict) and s.get("score", 5) < 3
            )
            real_plan_length = 12 if weak_count >= 4 else 7
            db.add(
                _make_coaching_plan(
                    report,
                    user["id"],
                    session.role,
                    generated["ai_assessments"],
                    plan_length=real_plan_length,
                    is_demo=False,
                )
            )
        await db.commit()
        await db.refresh(report)
        return _report_payload(report)
    except TokenBudgetExceeded as exc:
        report = await db.get(EvaluationReport, report_id)
        if report is not None:
            report.status = "failed"
            report.error = str(exc)
            await db.commit()
            return _report_payload(report)
        raise
    except EvaluationOutputError as exc:
        if tokens_reserved:
            await reconcile_tokens(
                db,
                user_id=user["id"],
                session_id=session_id,
                reserved_tokens=estimated_tokens,
                actual_tokens=0,
            )
            tokens_reserved = False
        report = await db.get(EvaluationReport, report_id)
        if report is not None:
            report.status = "failed"
            report.error = str(exc)
            await db.commit()
            return _report_payload(report)
        raise
    except ProviderError as exc:
        report = await db.get(EvaluationReport, report_id)
        if report is not None:
            report.status = "failed"
            report.error = exc.user_message
            await db.commit()
        raise _provider_http_exception(exc) from exc
    except LLMUnavailable:
        # The provider may have billed a request without returning usage metadata;
        # keep the full reservation rather than undercounting cost.
        report = await db.get(EvaluationReport, report_id)
        if report is not None:
            report.status = "failed"
            report.error = "The evaluation provider is temporarily unavailable."
            await db.commit()
            return _report_payload(report)
        raise
    except Exception:
        logger.exception("Evaluation failed session_id=%s", session_id)
        await db.rollback()
        report = await db.get(EvaluationReport, report_id)
        if report is not None:
            report.status = "failed"
            report.error = "Evaluation failed unexpectedly; no assessment was stored."
            await db.commit()
            return _report_payload(report)
        raise


@router.get("/sessions/{session_id}/analytics")
async def get_interview_analytics(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    session = await _owned_session(db, session_id, user["id"])
    transcript_rows = list(
        (
            await db.scalars(
                select(Transcript)
                .where(Transcript.session_id == session_id)
                .order_by(Transcript.id)
            )
        ).all()
    )
    return {
        "metrics": calculate_voice_metrics(
            [
                {
                    "speaker": row.speaker,
                    "message": row.message,
                    "language": row.language,
                    "timestamp_ms": row.timestamp_ms,
                    "duration_ms": row.duration_ms,
                }
                for row in transcript_rows
            ],
            started_at=session.started_at,
            duration_seconds=session.requested_duration_seconds,
        ),
        "source": "simulated" if session.is_demo else "real",
    }


class CoachingProgressUpdate(BaseModel):
    checked: bool | None = None
    notes: str | None = Field(default=None, max_length=1000)


@router.get("/sessions/{session_id}/coaching-plan")
async def get_coaching_plan(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    session = await _owned_session(db, session_id, user["id"])
    report = await db.scalar(
        select(EvaluationReport).where(EvaluationReport.session_id == session_id)
    )
    if report is None:
        raise HTTPException(status_code=404, detail="Coaching plan not found")
    plan = await db.scalar(
        select(CoachingPlan).where(
            CoachingPlan.evaluation_report_id == report.id,
            CoachingPlan.user_id == user["id"],
        )
    )
    if plan is None:
        raise HTTPException(status_code=404, detail="Coaching plan not found")
    return {
        "id": plan.id,
        "interview_id": session_id,
        **plan.plan_data,
        "completed_days": plan.completed_days,
        "progress_notes": plan.progress_notes or {},
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
    }


@router.post("/sessions/{session_id}/coaching-plan/update")
async def update_coaching_progress(
    session_id: str,
    day: int = Query(ge=1, le=12),
    notes: str | None = Query(default=None, max_length=1000),
    progress: CoachingProgressUpdate | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    await _owned_session(db, session_id, user["id"])
    report = await db.scalar(
        select(EvaluationReport).where(EvaluationReport.session_id == session_id)
    )
    if report is None:
        raise HTTPException(status_code=404, detail="Coaching plan not found")
    plan = await db.scalar(
        select(CoachingPlan).where(
            CoachingPlan.evaluation_report_id == report.id,
            CoachingPlan.user_id == user["id"],
        )
    )
    if plan is None:
        raise HTTPException(status_code=404, detail="Coaching plan not found")
    plan_data = deepcopy(plan.plan_data)
    days = list(plan_data.get("days", []))
    item = next((entry for entry in days if entry.get("day") == day), None)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Coaching plan day {day} not found")
    update_data = progress or CoachingProgressUpdate()
    if update_data.checked is not None:
        item["completed"] = update_data.checked
    plan_data["days"] = days
    plan.plan_data = plan_data
    progress_notes = dict(plan.progress_notes or {})
    effective_notes = update_data.notes if update_data.notes is not None else notes
    if effective_notes is not None:
        progress_notes[str(day)] = effective_notes
    plan.progress_notes = progress_notes
    plan.completed_days = sum(bool(entry.get("completed")) for entry in days)
    await db.commit()
    return {
        "status": "updated",
        "session_id": session_id,
        "day": day,
        "completed": bool(item.get("completed")),
        "completed_days": plan.completed_days,
    }


@router.get("/user/reports")
async def get_user_reports(
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = await db.scalars(
        select(EvaluationReport)
        .join(InterviewSession, EvaluationReport.session_id == InterviewSession.id)
        .where(
            InterviewSession.user_id == user["id"],
            InterviewSession.is_demo.is_(False),
        )
        .order_by(EvaluationReport.created_at.desc(), EvaluationReport.id.desc())
        .limit(limit)
        .offset(offset)
    )
    reports = list(result.all())
    return {
        "reports": [_report_payload(report) for report in reports],
        "total": len(reports),
    }
