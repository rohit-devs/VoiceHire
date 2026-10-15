import json
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.database import async_session
from app.interview.evaluation_engine import (
    EvaluationOutput,
    generate_assessment,
    load_rubric,
)
from app.interview.llm_provider import Completion
from app.main import app
from app.models import EvaluationReport, InterviewSession, Transcript, User

CATEGORY_SCORES = {
    "technical_correctness": 4,
    "relevance": 4,
    "structure_and_clarity": 2,
    "completeness_and_examples": 2,
    "problem_solving": 3,
    "communication": 4,
    "job_skill_alignment": 2,
}
WEAKEST = {
    "structure_and_clarity",
    "completeness_and_examples",
    "job_skill_alignment",
}


class ValidEvaluationProvider:
    def __init__(self, *, first_response: str | None = None):
        self.calls = 0
        self.first_response = first_response
        self.user_contents: list[str] = []

    async def complete(self, *, session_id, system_prompt, user_content, max_tokens):
        self.calls += 1
        self.user_contents.append(user_content)
        if self.calls == 1 and self.first_response is not None:
            return Completion(self.first_response, 90, 20)
        decoder = json.JSONDecoder()
        payload, _ = decoder.raw_decode(user_content)
        rubric = load_rubric()
        weighted = sum(
            CATEGORY_SCORES[name] * rubric["weights"][name]
            for name in CATEGORY_SCORES
        )
        items = payload["evaluation_items"]
        output = {
            "overall_score": round(weighted, 2),
            "category_scores": {
                name: {
                    "score": score,
                    "rationale": "The answer provides observable evidence for this criterion.",
                }
                for name, score in CATEGORY_SCORES.items()
            },
            "per_question_analysis": [
                {
                    "question_id": item["question_id"],
                    "question": item["question"],
                    "evidence_quote": item["candidate_answer"][:35],
                    "rationale": "This exact excerpt supports the answer assessment.",
                    "category_scores": CATEGORY_SCORES,
                }
                for item in items
            ],
            "strengths": ["Described an implementation with a measured outcome."],
            "missing_elements": ["Testing and rollback trade-offs were not explained."],
            "improved_answer_structure": [
                "State the problem and constraints.",
                "Explain the approach and trade-offs.",
                "Conclude with a measured result.",
            ],
            "practice_exercises": [
                {
                    "category": list(sorted(WEAKEST))[index % len(WEAKEST)],
                    "title": f"Practice task {index + 1}",
                    "task": "Outline an answer for a relevant system-design question.",
                    "target_role": "Backend Engineer",
                }
                for index in range(7)
            ],
        }
        return Completion(json.dumps(output), 420, 310)


class InvalidEvaluationProvider:
    def __init__(self):
        self.calls = 0

    async def complete(self, **_kwargs):
        self.calls += 1
        return Completion("{invalid json", 100, 40)


class FairnessRetryProvider(ValidEvaluationProvider):
    async def complete(self, *, session_id, system_prompt, user_content, max_tokens):
        completion = await super().complete(
            session_id=session_id,
            system_prompt=system_prompt,
            user_content=user_content,
            max_tokens=max_tokens,
        )
        if self.calls == 1:
            output = json.loads(completion.text)
            output["strengths"][0] = "The candidate seems nervous."
            return Completion(json.dumps(output), completion.prompt_tokens, completion.completion_tokens)
        return completion


def _transcripts():
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    return [
        Transcript(
            id=1,
            session_id="evaluation-test",
            speaker="interviewer",
            message="Describe an API performance improvement.",
            message_id=str(uuid4()),
            timestamp_ms=now_ms,
            source="real",
        ),
        Transcript(
            id=2,
            session_id="evaluation-test",
            speaker="candidate",
            message="I built a cache for repeated PostgreSQL reads.",
            message_id=str(uuid4()),
            timestamp_ms=now_ms,
            duration_ms=3000,
            source="real",
        ),
        Transcript(
            id=3,
            session_id="evaluation-test",
            speaker="interviewer",
            message="What was the measurable result?",
            message_id=str(uuid4()),
            timestamp_ms=now_ms + 3000,
            source="real",
        ),
        Transcript(
            id=4,
            session_id="evaluation-test",
            speaker="candidate",
            message="Latency dropped from 200 milliseconds to 80 milliseconds.",
            message_id=str(uuid4()),
            timestamp_ms=now_ms + 3000,
            duration_ms=6000,
            source="real",
        ),
    ]


def _session():
    return InterviewSession(
        id="evaluation-test",
        user_id="demo-user-001",
        role="Backend Engineer",
        difficulty="medium",
        agora_channel="eval-test",
        current_state="completed",
        requested_duration_seconds=600,
        is_demo=False,
        started_at=datetime.now(timezone.utc),
        metadata_json={
            "resume_text": "Built APIs and database services.",
            "job_description": "Own reliable backend services.",
        },
    )


def test_rubric_has_anchors_for_each_category_and_validates_weight_overrides():
    rubric = load_rubric()
    for category in rubric["categories"].values():
        assert set(category["anchors"]) == {0, 1, 2, 3, 4, 5}
    override = {category: 1 for category in rubric["categories"]}
    normalized = load_rubric(json.dumps(override))
    assert sum(normalized["weights"].values()) == pytest.approx(1.0)
    assert all(weight == pytest.approx(1 / 7) for weight in normalized["weights"].values())
    override["technical_correctness"] = float("nan")
    with pytest.raises(ValueError, match="weights are invalid"):
        load_rubric(json.dumps(override))


@pytest.mark.asyncio
async def test_evaluation_schema_validation_and_retry_after_invalid_json():
    provider = ValidEvaluationProvider(first_response="{not json")
    result = await generate_assessment(
        session_id="evaluation-test",
        session=_session(),
        transcripts=_transcripts(),
        context={"resume": "Built APIs.", "job_description": "Backend services."},
        provider=provider,
    )

    assert result["status"] == "completed"
    assert provider.calls == 2
    validated = EvaluationOutput.model_validate(result["ai_assessments"])
    assert len(validated.per_question_analysis) == 2
    assert "I built a cache for repeated PostgreSQL reads.".startswith(
        result["ai_assessments"]["per_question_analysis"][0]["evidence_quote"]
    )
    retry_payload, _ = json.JSONDecoder().raw_decode(provider.user_contents[1])
    assert retry_payload["evaluation_items"][0]["context"]["resume"] == "Built APIs."


@pytest.mark.asyncio
async def test_evaluation_fails_after_second_invalid_response_without_fabrication():
    provider = InvalidEvaluationProvider()
    result = await generate_assessment(
        session_id="evaluation-test",
        session=_session(),
        transcripts=_transcripts(),
        context={"resume": "", "job_description": ""},
        provider=provider,
    )
    assert provider.calls == 2
    assert result["status"] == "failed"
    assert result["ai_assessments"] is None
    assert result["error"]


@pytest.mark.asyncio
async def test_prohibited_personal_inference_is_rejected_and_retried():
    provider = FairnessRetryProvider()
    result = await generate_assessment(
        session_id="evaluation-test",
        session=_session(),
        transcripts=_transcripts(),
        context={"resume": "", "job_description": ""},
        provider=provider,
    )
    assert provider.calls == 2
    assert result["status"] == "completed"
    assessment_text = json.dumps(result["ai_assessments"]).lower()
    assert "nervous" not in assessment_text
    assert "personality" not in assessment_text


@pytest.mark.asyncio
async def test_missing_transcript_data_has_null_metrics_and_skips_provider():
    provider = InvalidEvaluationProvider()
    result = await generate_assessment(
        session_id="evaluation-test",
        session=_session(),
        transcripts=[],
        context={"resume": "", "job_description": ""},
        provider=provider,
    )
    assert result["status"] == "insufficient_data"
    assert result["ai_assessments"] is None
    assert result["measured_metrics"]["words_per_minute"]["value"] is None
    assert result["measured_metrics"]["words_per_minute"]["reason"]
    assert result["measured_metrics"]["questions_answered"]["value"] == 0
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_report_fails_explicitly_when_openai_is_not_configured(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        created = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built APIs and database services.",
                "job_description": "Own reliable backend services.",
                "is_demo": False,
            },
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        async with async_session() as db:
            session = await db.get(InterviewSession, session_id)
            assert session is not None
            session.current_state = "completed"
            session.status = "completed"
            session.started_at = datetime.now(timezone.utc)
            db.add_all(
                [
                    Transcript(
                        session_id=session_id,
                        speaker="interviewer",
                        message="Describe an API performance improvement.",
                        timestamp_ms=now_ms,
                        source="real",
                    ),
                    Transcript(
                        session_id=session_id,
                        speaker="candidate",
                        message="I improved API latency by adding a measured database index.",
                        timestamp_ms=now_ms + 1000,
                        duration_ms=5000,
                        source="real",
                    ),
                ]
            )
            await db.commit()

        response = await client.post(
            f"/api/evaluations/sessions/{session_id}/report/generate"
        )
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["status"] == "failed"
    assert report["ai_assessments"] is None
    assert "OpenAI provider is not configured" in report["error"]


@pytest.mark.asyncio
async def test_report_is_persisted_idempotently_with_measured_metrics_and_coaching(monkeypatch):
    from app.routers import evaluations

    provider = ValidEvaluationProvider()
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test-evaluation-provider-key")
    monkeypatch.setattr(evaluations, "_evaluation_provider", lambda: provider)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        created = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built APIs and database services.",
                "job_description": "Own reliable backend services.",
                "is_demo": False,
                "duration_seconds": 600,
            },
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        async with async_session() as db:
            session = await db.get(InterviewSession, session_id)
            session.current_state = "completed"
            session.status = "completed"
            session.started_at = datetime.now(timezone.utc)
            db.add_all(
                [
                    Transcript(
                        session_id=session_id,
                        speaker="interviewer",
                        message="Describe an API performance improvement.",
                        timestamp_ms=now_ms,
                        source="real",
                    ),
                    Transcript(
                        session_id=session_id,
                        speaker="candidate",
                        message="I built a cache for repeated PostgreSQL reads.",
                        timestamp_ms=now_ms,
                        duration_ms=3000,
                        source="real",
                    ),
                    Transcript(
                        session_id=session_id,
                        speaker="interviewer",
                        message="What was the measurable result?",
                        timestamp_ms=now_ms + 3000,
                        source="real",
                    ),
                    Transcript(
                        session_id=session_id,
                        speaker="candidate",
                        message="Latency dropped from 200 milliseconds to 80 milliseconds.",
                        timestamp_ms=now_ms + 3000,
                        duration_ms=6000,
                        source="real",
                    ),
                ]
            )
            await db.commit()

        generated = await client.post(
            f"/api/evaluations/sessions/{session_id}/report/generate"
        )
        assert generated.status_code == 200, generated.text
        report = generated.json()
        assert report["status"] == "completed"
        assert report["rubric_version"] == "1.0.0"
        assert report["measured_metrics"]["questions_answered"]["value"] == 2
        assert report["measured_metrics"]["words_per_minute"]["value"] == 106.7
        assert report["measured_metrics"]["answer_length_words"]["value"] == 8.0
        assert report["ai_assessments"]["per_question_analysis"][0]["evidence_quote"] in (
            "I built a cache for repeated PostgreSQL reads."
        )
        assert report["guidance_note"]
        assert provider.calls == 1

        repeated = await client.post(
            f"/api/evaluations/sessions/{session_id}/report/generate"
        )
        reloaded = await client.get(
            f"/api/evaluations/sessions/{session_id}/report"
        )
        assert repeated.json() == report
        assert reloaded.json() == report
        assert provider.calls == 1
        coaching = await client.get(
            f"/api/evaluations/sessions/{session_id}/coaching-plan"
        )
        assert coaching.status_code == 200, coaching.text
        assert coaching.json()["total_days"] == 7
        updated = await client.post(
            f"/api/evaluations/sessions/{session_id}/coaching-plan/update?day=1",
            json={"checked": True, "notes": "Completed this exercise."},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["completed_days"] == 1
        updated_plan = await client.get(
            f"/api/evaluations/sessions/{session_id}/coaching-plan"
        )
        assert updated_plan.json()["days"][0]["completed"] is True
        assert updated_plan.json()["progress_notes"]["1"] == "Completed this exercise."


@pytest.mark.asyncio
async def test_report_ownership_and_demo_isolation(monkeypatch):
    from app.routers import evaluations

    provider = InvalidEvaluationProvider()
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test-evaluation-provider-key")
    monkeypatch.setattr(evaluations, "_evaluation_provider", lambda: provider)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        created = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built APIs.",
                "job_category": "backend",
                "is_demo": True,
            },
        )
        assert created.status_code == 200, created.text
        demo_id = created.json()["id"]
        blocked_demo = await client.post(
            f"/api/evaluations/sessions/{demo_id}/report/generate"
        )
        assert blocked_demo.status_code == 409
        assert provider.calls == 0

        real = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built APIs.",
                "job_category": "backend",
                "is_demo": False,
            },
        )
        assert real.status_code == 200, real.text
        real_id = real.json()["id"]
        async with async_session() as db:
            other_user = User(
                id="evaluation-other-user",
                clerk_id="evaluation-other-user",
                email="other@example.test",
            )
            db.add(other_user)
            session = await db.get(InterviewSession, real_id)
            session.user_id = other_user.id
            await db.commit()
        unauthorized = await client.get(
            f"/api/evaluations/sessions/{real_id}/report"
        )
        assert unauthorized.status_code == 403


@pytest.mark.asyncio
async def test_invalid_provider_output_is_persisted_as_failed_report(monkeypatch):
    from app.routers import evaluations

    provider = InvalidEvaluationProvider()
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-test-evaluation-provider-key")
    monkeypatch.setattr(evaluations, "_evaluation_provider", lambda: provider)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        created = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built APIs.",
                "job_category": "backend",
                "is_demo": False,
            },
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        async with async_session() as db:
            session = await db.get(InterviewSession, session_id)
            session.current_state = "completed"
            session.status = "completed"
            db.add_all(
                [
                    Transcript(
                        session_id=session_id,
                        speaker="interviewer",
                        message="Describe a backend service you built.",
                        timestamp_ms=now_ms,
                        source="real",
                    ),
                    Transcript(
                        session_id=session_id,
                        speaker="candidate",
                        message="I built a Python API for internal users.",
                        timestamp_ms=now_ms,
                        duration_ms=5000,
                        source="real",
                    ),
                ]
            )
            await db.commit()
        response = await client.post(
            f"/api/evaluations/sessions/{session_id}/report/generate"
        )
        assert response.status_code == 200, response.text
        failed = response.json()
        assert failed["status"] == "failed"
        assert failed["error"]
        assert failed["ai_assessments"] is None
        assert provider.calls == 2
        reloaded = await client.get(f"/api/evaluations/sessions/{session_id}/report")
        assert reloaded.json() == failed
        assert provider.calls == 2
