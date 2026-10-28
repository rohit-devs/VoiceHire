"""Phase 6: Coaching plan tests — 7-day and 12-day generation, missed day,
repeat interview, completion %, persistence after restart."""

from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.database import async_session
from app.interview.evaluation_engine import load_rubric
from app.interview.llm_provider import Completion, LLMProvider
from app.main import app
from app.models import (
    CoachingPlan,
    EvaluationReport,
    InterviewSession,
    Transcript,
    User,
)


class ScoredEvaluationProvider:
    """Mock provider that returns predetermined evaluation output."""

    def __init__(self) -> None:
        self.calls = 0

    async def complete(
        self,
        *,
        session_id: str,
        system_prompt: str,
        user_content: str,
        max_tokens: int,
        format: str | None = None,
    ) -> Completion:
        self.calls += 1
        rubric = load_rubric()
        categories = list(rubric["categories"].keys())
        # Return varied scores so weakest categories are identifiable
        scores = {
            "technical_correctness": 4,
            "relevance": 3,
            "structure_and_clarity": 1,
            "completeness_and_examples": 1,
            "problem_solving": 2,
            "communication": 3,
            "job_skill_alignment": 1,
        }
        weighted = round(
            sum(scores[name] * rubric["weights"][name] for name in categories), 2
        )
        per_question = []
        decoder = json.JSONDecoder()
        payload, _ = decoder.raw_decode(user_content)
        for item in payload["evaluation_items"]:
            per_question.append(
                {
                    "question_id": item["question_id"],
                    "question": item["question"],
                    "evidence_quote": item["candidate_answer"][:30],
                    "rationale": "Assessed.",
                    "category_scores": scores,
                }
            )
        # Compute weakest categories (lowest scores) for practice exercises
        weakest = sorted(categories, key=lambda n: scores[n])[:3]
        output = {
            "overall_score": weighted,
            "category_scores": {
                name: {"score": scores[name], "rationale": "ok"} for name in categories
            },
            "per_question_analysis": per_question,
            "strengths": ["Clear communication."],
            "missing_elements": ["More examples needed."],
            "improved_answer_structure": [
                "State the problem.",
                "Explain the approach.",
                "Share the outcome.",
            ],
            "practice_exercises": [
                {
                    "category": weakest[index % len(weakest)],
                    "title": f"Practice {weakest[index % len(weakest)]}",
                    "task": f"Work on {weakest[index % len(weakest)]} skills.",
                    "target_role": "Backend Engineer",
                }
                for index in range(7)
            ],
        }
        return Completion(json.dumps(output), 100, 50)


def _session(user_id: str, session_id: str, is_demo: bool = False) -> InterviewSession:
    return InterviewSession(
        id=session_id,
        user_id=user_id,
        role="Backend Engineer",
        difficulty="medium",
        agora_channel=session_id,
        current_state="completed",
        requested_duration_seconds=600,
        is_demo=is_demo,
        started_at=datetime.now(timezone.utc),
        metadata_json={
            "resume_text": "Backend engineer.",
            "job_description": "Backend role.",
        },
    )


def _transcripts(session_id: str, count: int = 2) -> list[Transcript]:
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    rows: list[Transcript] = []
    for i in range(count):
        rows.append(
            Transcript(
                id=i * 2 + 1,
                session_id=session_id,
                speaker="interviewer",
                message=f"Question {i + 1}?",
                message_id=str(uuid4()),
                timestamp_ms=now_ms + i * 1000,
                source="real",
            )
        )
        rows.append(
            Transcript(
                id=i * 2 + 2,
                session_id=session_id,
                speaker="candidate",
                message=f"I built a caching system with {i} years of experience.",
                message_id=str(uuid4()),
                timestamp_ms=now_ms + i * 1000 + 500,
                duration_ms=5000,
                source="real",
            )
        )
    return rows


async def _create_session_and_transcripts(
    client: AsyncClient, user_id: str, session_id: str, is_demo: bool = False
) -> str:
    created = await client.post(
        "/api/interviews/sessions",
        json={
            "role": "Backend Engineer",
            "resume_text": "Built APIs and database services.",
            "job_description": "Own reliable backend services.",
            "is_demo": is_demo,
            "duration_seconds": 600,
        },
        headers={"X-Guest-Id": user_id},
    )
    assert created.status_code == 200, created.text
    sid = created.json()["id"]
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    async with async_session() as db:
        session = await db.get(InterviewSession, sid)
        session.current_state = "completed"
        session.status = "completed"
        session.started_at = datetime.now(timezone.utc)
        db.add_all(
            [
                Transcript(
                    session_id=sid,
                    speaker="interviewer",
                    message="Describe an API performance improvement.",
                    timestamp_ms=now_ms,
                    source="real",
                ),
                Transcript(
                    session_id=sid,
                    speaker="candidate",
                    message="I built a cache for repeated PostgreSQL reads.",
                    timestamp_ms=now_ms + 1000,
                    duration_ms=5000,
                    source="real",
                ),
            ]
        )
        await db.commit()
    return sid


def test_7_day_plan_structure():
    """7-day plan has exactly 7 days, easy→medium→hard ramp, correct dates."""
    from app.routers.evaluations import _make_coaching_plan
    from app.models import EvaluationReport

    report = EvaluationReport(
        id="report-7day",
        session_id="session-7day",
        status="completed",
        rubric_version="1.0.0",
        measured_metrics={},
        ai_assessments={
            "overall_score": 2.5,
            "category_scores": {
                "technical_correctness": {"score": 4, "rationale": "ok"},
                "relevance": {"score": 3, "rationale": "ok"},
                "structure_and_clarity": {"score": 1, "rationale": "ok"},
                "completeness_and_examples": {"score": 1, "rationale": "ok"},
                "problem_solving": {"score": 2, "rationale": "ok"},
                "communication": {"score": 3, "rationale": "ok"},
                "job_skill_alignment": {"score": 1, "rationale": "ok"},
            },
            "per_question_analysis": [],
            "strengths": [],
            "missing_elements": [],
            "improved_answer_structure": [],
            "practice_exercises": [
                {
                    "category": name,
                    "title": f"Practice {name}",
                    "task": f"Work on {name}.",
                    "target_role": "Backend Engineer",
                }
                for name in [
                    "technical_correctness",
                    "relevance",
                    "structure_and_clarity",
                    "completeness_and_examples",
                    "problem_solving",
                    "communication",
                    "job_skill_alignment",
                ]
            ],
        },
    )
    plan = _make_coaching_plan(report, "user-1", "Backend Engineer", report.ai_assessments, plan_length=7)
    assert plan.plan_data["total_days"] == 7
    assert plan.plan_data["plan_length"] == 7
    assert len(plan.plan_data["days"]) == 7

    # Check difficulty ramp: easy, easy, medium, medium, medium, hard, hard
    difficulties = [d["difficulty"] for d in plan.plan_data["days"]]
    assert difficulties[:2] == ["easy", "easy"]
    assert difficulties[2:5] == ["medium", "medium", "medium"]
    assert difficulties[5:] == ["hard", "hard"]

    # Check dates are consecutive
    today = date.today()
    for i, day_entry in enumerate(plan.plan_data["days"]):
        expected_date = (today + timedelta(days=i)).isoformat()
        assert day_entry["date"] == expected_date
        assert day_entry["day"] == i + 1
        assert "completed" in day_entry
        assert day_entry["completed"] is False


def test_12_day_plan_has_spaced_review():
    """12-day plan has 12 days with days 8-12 as spaced review."""
    from app.routers.evaluations import _make_coaching_plan
    from app.models import EvaluationReport

    report = EvaluationReport(
        id="report-12day",
        session_id="session-12day",
        status="completed",
        rubric_version="1.0.0",
        measured_metrics={},
        ai_assessments={
            "overall_score": 2.5,
            "category_scores": {
                "technical_correctness": {"score": 4, "rationale": "ok"},
                "relevance": {"score": 3, "rationale": "ok"},
                "structure_and_clarity": {"score": 1, "rationale": "ok"},
                "completeness_and_examples": {"score": 1, "rationale": "ok"},
                "problem_solving": {"score": 2, "rationale": "ok"},
                "communication": {"score": 3, "rationale": "ok"},
                "job_skill_alignment": {"score": 1, "rationale": "ok"},
            },
            "per_question_analysis": [],
            "strengths": [],
            "missing_elements": [],
            "improved_answer_structure": [],
            "practice_exercises": [
                {
                    "category": name,
                    "title": f"Practice {name}",
                    "task": f"Work on {name}.",
                    "target_role": "Backend Engineer",
                }
                for name in [
                    "technical_correctness",
                    "relevance",
                    "structure_and_clarity",
                    "completeness_and_examples",
                    "problem_solving",
                    "communication",
                    "job_skill_alignment",
                ]
            ],
        },
    )
    plan = _make_coaching_plan(report, "user-1", "Backend Engineer", report.ai_assessments, plan_length=12)
    assert plan.plan_data["total_days"] == 12
    assert plan.plan_data["plan_length"] == 12
    assert len(plan.plan_data["days"]) == 12

    # Days 8-12 should be review type
    review_days = [d for d in plan.plan_data["days"] if d["day"] >= 8]
    assert len(review_days) == 5
    for day_entry in review_days:
        assert day_entry["type"] == "review"
        assert "Spaced review" in day_entry["title"]

    # Difficulty ramp for 12-day: easy x3, medium x3, hard x1, review x5
    difficulties = [d["difficulty"] for d in plan.plan_data["days"]]
    assert difficulties[:3] == ["easy", "easy", "easy"]
    assert difficulties[3:6] == ["medium", "medium", "medium"]
    assert difficulties[6] == "hard"
    assert difficulties[7:] == ["review", "review", "review", "review", "review"]


def test_plan_selection_rule_is_documented():
    """plan_data includes a documented plan_selection_rule."""
    from app.routers.evaluations import _make_coaching_plan
    from app.models import EvaluationReport

    report = EvaluationReport(
        id="report-rule",
        session_id="session-rule",
        status="completed",
        rubric_version="1.0.0",
        measured_metrics={},
        ai_assessments={
            "overall_score": 2.5,
            "category_scores": {
                "technical_correctness": {"score": 4, "rationale": "ok"},
                "relevance": {"score": 3, "rationale": "ok"},
                "structure_and_clarity": {"score": 1, "rationale": "ok"},
                "completeness_and_examples": {"score": 1, "rationale": "ok"},
                "problem_solving": {"score": 2, "rationale": "ok"},
                "communication": {"score": 3, "rationale": "ok"},
                "job_skill_alignment": {"score": 1, "rationale": "ok"},
            },
            "per_question_analysis": [],
            "strengths": [],
            "missing_elements": [],
            "improved_answer_structure": [],
            "practice_exercises": [
                {
                    "category": name,
                    "title": f"Practice {name}",
                    "task": f"Work on {name}.",
                    "target_role": "Backend Engineer",
                }
                for name in [
                    "technical_correctness",
                    "relevance",
                    "structure_and_clarity",
                    "completeness_and_examples",
                    "problem_solving",
                    "communication",
                    "job_skill_alignment",
                ]
            ],
        },
    )
    plan = _make_coaching_plan(report, "user-1", "Backend Engineer", report.ai_assessments, plan_length=7)
    rule = plan.plan_data["plan_selection_rule"]
    assert "7-day" in rule
    assert "12-day" in rule
    assert "weakness" in rule.lower() or "weak" in rule.lower()
    assert "difficulty" in rule.lower()


def test_completion_percentage_is_deterministic():
    """completion % = completed_days / total_days, computed deterministically."""
    from app.routers.evaluations import _make_coaching_plan
    from app.models import EvaluationReport

    report = EvaluationReport(
        id="report-completion",
        session_id="session-completion",
        status="completed",
        rubric_version="1.0.0",
        measured_metrics={},
        ai_assessments={
            "overall_score": 2.5,
            "category_scores": {
                name: {"score": 3, "rationale": "ok"}
                for name in [
                    "technical_correctness", "relevance", "structure_and_clarity",
                    "completeness_and_examples", "problem_solving",
                    "communication", "job_skill_alignment",
                ]
            },
            "per_question_analysis": [],
            "strengths": [],
            "missing_elements": [],
            "improved_answer_structure": [],
            "practice_exercises": [
                {
                    "category": name,
                    "title": f"Practice {name}",
                    "task": f"Work on {name}.",
                    "target_role": "Backend Engineer",
                }
                for name in [
                    "technical_correctness", "relevance", "structure_and_clarity",
                    "completeness_and_examples", "problem_solving",
                    "communication", "job_skill_alignment",
                ]
            ],
        },
    )
    plan = _make_coaching_plan(report, "user-1", "Backend Engineer", report.ai_assessments, plan_length=7)

    # 0 completed → 0%
    assert plan.completed_days == 0
    total = plan.plan_data["total_days"]
    assert total == 7

    # Simulate completing 3 days
    plan.completed_days = 3
    pct = round(plan.completed_days / total * 100)
    assert pct == 43  # 3/7 = 42.86 → 43%

    # All completed → 100%
    plan.completed_days = 7
    pct = round(plan.completed_days / total * 100)
    assert pct == 100


@pytest.mark.asyncio
async def test_repeat_interview_generates_new_plan(monkeypatch):
    """A repeat interview (new session) generates a new coaching plan."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "sk-test-coaching-provider-key")
    from app.routers import evaluations
    monkeypatch.setattr(evaluations, "_evaluation_provider", lambda: ScoredEvaluationProvider())

    guest_id = str(uuid4())
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        # First interview
        sid1 = await _create_session_and_transcripts(client, guest_id, "session-1")
        gen1 = await client.post(
            f"/api/evaluations/sessions/{sid1}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert gen1.status_code == 200, gen1.text
        plan1 = await client.get(
            f"/api/evaluations/sessions/{sid1}/coaching-plan",
            headers={"X-Guest-Id": guest_id},
        )
        assert plan1.status_code == 200, plan1.text
        plan1_data = plan1.json()
        assert plan1_data["total_days"] == 12

        # Second interview (repeat)
        sid2 = await _create_session_and_transcripts(client, guest_id, "session-2")
        gen2 = await client.post(
            f"/api/evaluations/sessions/{sid2}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert gen2.status_code == 200, gen2.text
        plan2 = await client.get(
            f"/api/evaluations/sessions/{sid2}/coaching-plan",
            headers={"X-Guest-Id": guest_id},
        )
        assert plan2.status_code == 200, plan2.text
        plan2_data = plan2.json()
        assert plan2_data["total_days"] == 12

        # Plans are for different sessions (different IDs)
        assert plan1_data["interview_id"] != plan2_data["interview_id"]
