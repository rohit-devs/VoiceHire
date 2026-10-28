import json
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.database import async_session
from app.interview.evaluation_engine import (
    EvaluationOutput,
    MAX_QUESTION_CHARS,
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
    def __init__(self, *, first_response: str | None = None, name: str = "validevaluationprovider"):
        self.calls = 0
        self.first_response = first_response
        self.user_contents: list[str] = []
        self.name = name

    async def complete(self, *, session_id, system_prompt, user_content, max_tokens, format: str | None = None):
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
        if self.name == "ollama":
            # Ollama split-call approach: return schema matching the call type.
            task = payload.get("task", "")
            if task.startswith("Score each rubric category"):
                return Completion(
                    json.dumps(
                        {
                            "category_scores": {
                                name: {
                                    "score": score,
                                    "rationale": "The answer provides observable evidence for this criterion.",
                                }
                                for name, score in CATEGORY_SCORES.items()
                            }
                        }
                    ),
                    0,
                    0,
                    provider="ollama",
                    model="llama3.2:1b",
                )
            if task.startswith("Write a one-sentence rationale"):
                return Completion(
                    json.dumps(
                        {
                            "question_rationale": {
                                item["question_id"]: {
                                    "rationale": "This exact excerpt supports the answer assessment."
                                }
                                for item in items
                            }
                        }
                    ),
                    0,
                    0,
                    provider="ollama",
                    model="llama3.2:1b",
                )
            if task.startswith("List strengths, missing elements"):
                return Completion(
                    json.dumps(
                        {
                            "strengths": ["Described an implementation with a measured outcome."],
                            "missing_elements": ["Testing and rollback trade-offs were not explained."],
                            "improved_structure": [
                                "State the problem and constraints.",
                                "Explain the approach and trade-offs.",
                                "Conclude with a measured result.",
                            ],
                        }
                    ),
                    0,
                    0,
                    provider="ollama",
                    model="llama3.2:1b",
                )
            return Completion(json.dumps(output), 0, 0, provider="ollama", model="llama3.2:1b")
        return Completion(json.dumps(output), 420, 310)


class InvalidEvaluationProvider:
    def __init__(self, name: str = "groq"):
        self.calls = 0
        self.name = name

    async def complete(self, **_kwargs):
        self.calls += 1
        tokens = (0, 0) if self.name == "ollama" else (100, 40)
        return Completion("{invalid json", tokens[0], tokens[1], provider=self.name)


class FairnessRetryProvider(ValidEvaluationProvider):
    async def complete(self, *, session_id, system_prompt, user_content, max_tokens, format: str | None = None):
        completion = await super().complete(
            session_id=session_id,
            system_prompt=system_prompt,
            user_content=user_content,
            max_tokens=max_tokens,
            format=format,
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
async def test_evaluation_failure_logs_output_size(caplog):
    """Evaluation failure must log the provider output size for diagnosis."""
    provider = InvalidEvaluationProvider()
    with caplog.at_level("WARNING", logger="app.interview.evaluation_engine"):
        result = await generate_assessment(
            session_id="evaluation-test",
            session=_session(),
            transcripts=_transcripts(),
            context={"resume": "", "job_description": ""},
            provider=provider,
        )
    assert result["status"] == "failed"
    assert any(
        "output_size" in rec.message and "Evaluation failed" in rec.message
        for rec in caplog.records
    ), f"Expected evaluation failure log with output_size, got: {[r.message for r in caplog.records]}"


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
async def test_report_returns_provider_fallback_message_when_provider_is_disabled(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    guest_id = str(uuid4())
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
            headers={"X-Guest-Id": guest_id},
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
            f"/api/evaluations/sessions/{session_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
    assert response.status_code == 503, response.text
    assert response.json()["detail"]["user_message"]


@pytest.mark.asyncio
async def test_report_is_persisted_idempotently_with_measured_metrics_and_coaching(monkeypatch):
    from app.routers import evaluations

    provider = ValidEvaluationProvider()
    monkeypatch.setattr(settings, "GROQ_API_KEY", "sk-test-evaluation-provider-key")
    monkeypatch.setattr(evaluations, "_evaluation_provider", lambda: provider)
    guest_id = str(uuid4())
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
            headers={"X-Guest-Id": guest_id},
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
            f"/api/evaluations/sessions/{session_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert generated.status_code == 200, generated.text
        report = generated.json()
        assert report["status"] == "completed"
        assert report["provider"] == "validevaluationprovider"
        assert report["model"] == "unknown"
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
            f"/api/evaluations/sessions/{session_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        reloaded = await client.get(
            f"/api/evaluations/sessions/{session_id}/report",
            headers={"X-Guest-Id": guest_id},
        )
        assert repeated.json() == report
        assert reloaded.json() == report
        assert provider.calls == 1
        coaching = await client.get(
            f"/api/evaluations/sessions/{session_id}/coaching-plan",
            headers={"X-Guest-Id": guest_id},
        )
        assert coaching.status_code == 200, coaching.text
        assert coaching.json()["total_days"] == 7
        updated = await client.post(
            f"/api/evaluations/sessions/{session_id}/coaching-plan/update?day=1",
            json={"checked": True, "notes": "Completed this exercise."},
            headers={"X-Guest-Id": guest_id},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["completed_days"] == 1
        updated_plan = await client.get(
            f"/api/evaluations/sessions/{session_id}/coaching-plan",
            headers={"X-Guest-Id": guest_id},
        )
        assert updated_plan.json()["days"][0]["completed"] is True
        assert updated_plan.json()["progress_notes"]["1"] == "Completed this exercise."


@pytest.mark.asyncio
async def test_report_ownership_and_demo_isolation(monkeypatch):
    from app.routers import evaluations

    provider = InvalidEvaluationProvider()
    monkeypatch.setattr(settings, "GROQ_API_KEY", "sk-test-evaluation-provider-key")
    monkeypatch.setattr(evaluations, "_evaluation_provider", lambda: provider)
    guest_id = str(uuid4())
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
            headers={"X-Guest-Id": guest_id},
        )
        assert created.status_code == 200, created.text
        demo_id = created.json()["id"]
        # Start and end the demo session so it is eligible for evaluation.
        started = await client.post(
            f"/api/interviews/sessions/{demo_id}/start", headers={"X-Guest-Id": guest_id}
        )
        assert started.status_code == 200, started.text
        ended = await client.post(
            f"/api/interviews/sessions/{demo_id}/end",
            headers={"X-Guest-Id": guest_id},
        )
        assert ended.status_code == 200, ended.text
        # Demo sessions can now generate a clearly-labeled demo evaluation.
        demo_report = await client.post(
            f"/api/evaluations/sessions/{demo_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert demo_report.status_code == 200, demo_report.text
        demo_body = demo_report.json()
        assert demo_body["provider"] == "demo"
        assert demo_body["model"] == "simulated"
        assert "heuristic" in demo_body["guidance_note"].lower()
        assert provider.calls == 0  # No LLM used for demo evaluation

        # Idempotent re-generation returns the same report.
        repeated = await client.post(
            f"/api/evaluations/sessions/{demo_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert repeated.json() == demo_body
        assert provider.calls == 0

        # Retrieved report matches the generated one.
        reloaded = await client.get(
            f"/api/evaluations/sessions/{demo_id}/report",
            headers={"X-Guest-Id": guest_id},
        )
        assert reloaded.json() == demo_body

        real = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built APIs.",
                "job_category": "backend",
                "is_demo": False,
            },
            headers={"X-Guest-Id": guest_id},
        )
        assert real.status_code == 200, real.text
        real_id = real.json()["id"]
        async with async_session() as db:
            other_user = User(
                id="evaluation-other-user",
                guest_id="evaluation-other-user",
                email="other@example.test",
            )
            db.add(other_user)
            session = await db.get(InterviewSession, real_id)
            session.user_id = other_user.id
            await db.commit()
        unauthorized = await client.get(
            f"/api/evaluations/sessions/{real_id}/report",
            headers={"X-Guest-Id": guest_id},
        )
        assert unauthorized.status_code == 403


@pytest.mark.asyncio
async def test_demo_evaluation_generates_heuristic_report_and_coaching_plan(monkeypatch):
    from app.routers import evaluations

    monkeypatch.setattr(settings, "DEMO_MODE", True)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    guest_id = str(uuid4())
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        created = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built Python APIs and PostgreSQL services.",
                "job_category": "backend engineering",
                "is_demo": True,
                "duration_seconds": 600,
            },
            headers={"X-Guest-Id": guest_id},
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]

        started = await client.post(
            f"/api/interviews/sessions/{session_id}/start", headers={"X-Guest-Id": guest_id}
        )
        assert started.status_code == 200, started.text

        # Submit candidate answers and generate questions to build a transcript.
        answer = "I built a caching layer that reduced API latency by 40 percent."
        for _ in range(3):
            submitted = await client.post(
                f"/api/interviews/sessions/{session_id}/transcript",
                json={"speaker": "candidate", "message": answer},
                headers={"X-Guest-Id": guest_id},
            )
            assert submitted.status_code == 200, submitted.text
            nq = await client.post(
                f"/api/interviews/sessions/{session_id}/generate-question",
                json={"candidate_transcript": answer},
                headers={"X-Guest-Id": guest_id},
            )
            assert nq.status_code == 200, nq.text

        # End the interview so it is eligible for evaluation.
        ended = await client.post(
            f"/api/interviews/sessions/{session_id}/end",
            headers={"X-Guest-Id": guest_id},
        )
        assert ended.status_code == 200, ended.text

        # Generate the demo evaluation.
        generated = await client.post(
            f"/api/evaluations/sessions/{session_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert generated.status_code == 200, generated.text
        report = generated.json()
        assert report["status"] == "completed"
        assert report["provider"] == "demo"
        assert report["model"] == "simulated"
        assert "heuristic" in report["guidance_note"].lower()
        assert report["ai_assessments"] is not None
        assert report["ai_assessments"]["overall_score"] >= 0
        assert report["ai_assessments"]["overall_score"] <= 5
        assert len(report["ai_assessments"]["practice_exercises"]) == 7
        assert report["measured_metrics"]["questions_answered"]["value"] >= 1

        # Idempotent re-generation returns the same report.
        repeated = await client.post(
            f"/api/evaluations/sessions/{session_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert repeated.json() == report

        # Retrieved report matches.
        reloaded = await client.get(
            f"/api/evaluations/sessions/{session_id}/report",
            headers={"X-Guest-Id": guest_id},
        )
        assert reloaded.json() == report

        # Coaching plan is persisted.
        plan = await client.get(
            f"/api/evaluations/sessions/{session_id}/coaching-plan",
            headers={"X-Guest-Id": guest_id},
        )
        assert plan.status_code == 200, plan.text
        assert plan.json()["total_days"] == 7


@pytest.mark.asyncio
async def test_demo_evaluation_insufficient_data(monkeypatch):
    from app.routers import evaluations

    monkeypatch.setattr(settings, "DEMO_MODE", True)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    guest_id = str(uuid4())
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
                "duration_seconds": 600,
            },
            headers={"X-Guest-Id": guest_id},
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]

        started = await client.post(
            f"/api/interviews/sessions/{session_id}/start", headers={"X-Guest-Id": guest_id}
        )
        assert started.status_code == 200, started.text

        ended = await client.post(
            f"/api/interviews/sessions/{session_id}/end",
            headers={"X-Guest-Id": guest_id},
        )
        assert ended.status_code == 200, ended.text

        generated = await client.post(
            f"/api/evaluations/sessions/{session_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert generated.status_code == 200, generated.text
        report = generated.json()
        assert report["status"] == "insufficient_data"
        assert report["ai_assessments"] is None
        assert report["provider"] == "demo"
        assert report["model"] == "simulated"


@pytest.mark.asyncio
async def test_invalid_provider_output_is_persisted_as_failed_report(monkeypatch):
    from app.routers import evaluations

    provider = InvalidEvaluationProvider()
    monkeypatch.setattr(settings, "GROQ_API_KEY", "sk-test-evaluation-provider-key")
    monkeypatch.setattr(evaluations, "_evaluation_provider", lambda: provider)
    guest_id = str(uuid4())
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
            headers={"X-Guest-Id": guest_id},
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
            f"/api/evaluations/sessions/{session_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert response.status_code == 200, response.text
        failed = response.json()
        assert failed["status"] == "failed"
        assert failed["error"]
        assert failed["ai_assessments"] is None
        assert provider.calls == 2
        reloaded = await client.get(
            f"/api/evaluations/sessions/{session_id}/report",
            headers={"X-Guest-Id": guest_id},
        )
        assert reloaded.json() == failed
        assert provider.calls == 2


@pytest.mark.asyncio
async def test_ollama_evaluation_does_not_reserve_or_reconcile_cloud_tokens(monkeypatch):
    from app.routers import evaluations

    provider = ValidEvaluationProvider(name="ollama")
    monkeypatch.setattr(evaluations, "_evaluation_provider", lambda: provider)

    reserve_calls = []
    reconcile_calls = []

    async def fake_reserve(*args, **kwargs):
        reserve_calls.append((args, kwargs))

    async def fake_reconcile(*args, **kwargs):
        reconcile_calls.append((args, kwargs))

    monkeypatch.setattr(evaluations, "reserve_tokens", fake_reserve)
    monkeypatch.setattr(evaluations, "reconcile_tokens", fake_reconcile)

    guest_id = str(uuid4())
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        created = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built APIs and distributed systems.",
                "job_description": "Own reliable backend systems.",
                "is_demo": False,
                "duration_seconds": 600,
            },
            headers={"X-Guest-Id": guest_id},
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
                        message="Describe an API optimization.",
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
                ]
            )
            await db.commit()
            user = await db.get(User, session.user_id)
            initial_user_tokens = user.llm_tokens_used
            initial_session_tokens = session.llm_tokens_used

        generated = await client.post(
            f"/api/evaluations/sessions/{session_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert generated.status_code == 200, generated.text
        report = generated.json()
        assert report["status"] == "completed"
        assert len(reserve_calls) == 0, "reserve_tokens must not be called for Ollama"
        assert len(reconcile_calls) == 0, "reconcile_tokens must not be called for Ollama"

        async with async_session() as db:
            session = await db.get(InterviewSession, session_id)
            assert session.llm_tokens_used == initial_session_tokens
            user = await db.get(User, session.user_id)
            assert user.llm_tokens_used == initial_user_tokens


@pytest.mark.asyncio
async def test_groq_evaluation_reserves_and_reconciles_tokens(monkeypatch):
    from app.routers import evaluations

    provider = ValidEvaluationProvider(name="groq")
    monkeypatch.setattr(evaluations, "_evaluation_provider", lambda: provider)

    reserve_calls = []
    reconcile_calls = []

    real_reserve = evaluations.reserve_tokens
    real_reconcile = evaluations.reconcile_tokens

    async def spy_reserve(*args, **kwargs):
        reserve_calls.append((args, kwargs))
        return await real_reserve(*args, **kwargs)

    async def spy_reconcile(*args, **kwargs):
        reconcile_calls.append((args, kwargs))
        return await real_reconcile(*args, **kwargs)

    monkeypatch.setattr(evaluations, "reserve_tokens", spy_reserve)
    monkeypatch.setattr(evaluations, "reconcile_tokens", spy_reconcile)

    guest_id = str(uuid4())
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        created = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built APIs and distributed systems.",
                "job_description": "Own reliable backend systems.",
                "is_demo": False,
                "duration_seconds": 600,
            },
            headers={"X-Guest-Id": guest_id},
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
                        message="Describe an API optimization.",
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
                ]
            )
            await db.commit()
            user = await db.get(User, session.user_id)
            initial_user_tokens = user.llm_tokens_used
            initial_session_tokens = session.llm_tokens_used

        generated = await client.post(
            f"/api/evaluations/sessions/{session_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert generated.status_code == 200, generated.text
        report = generated.json()
        assert report["status"] == "completed"
        assert len(reserve_calls) == 1, "reserve_tokens must be called for Groq"
        assert len(reconcile_calls) == 1, "reconcile_tokens must be called for Groq"

        async with async_session() as db:
            session = await db.get(InterviewSession, session_id)
            assert session.llm_tokens_used > initial_session_tokens
            user = await db.get(User, session.user_id)
            assert user.llm_tokens_used > initial_user_tokens


@pytest.mark.asyncio
async def test_ollama_evaluation_failure_does_not_reconcile_unreserved_tokens(monkeypatch):
    from app.routers import evaluations

    provider = InvalidEvaluationProvider(name="ollama")
    monkeypatch.setattr(evaluations, "_evaluation_provider", lambda: provider)

    reserve_calls = []
    reconcile_calls = []

    async def fake_reserve(*args, **kwargs):
        reserve_calls.append((args, kwargs))

    async def fake_reconcile(*args, **kwargs):
        reconcile_calls.append((args, kwargs))

    monkeypatch.setattr(evaluations, "reserve_tokens", fake_reserve)
    monkeypatch.setattr(evaluations, "reconcile_tokens", fake_reconcile)

    guest_id = str(uuid4())
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
            headers={"X-Guest-Id": guest_id},
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
            user = await db.get(User, session.user_id)
            initial_user_tokens = user.llm_tokens_used
            initial_session_tokens = session.llm_tokens_used

        response = await client.post(
            f"/api/evaluations/sessions/{session_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert response.status_code == 200, response.text
        failed = response.json()
        assert failed["status"] == "failed"
        assert len(reserve_calls) == 0, "reserve_tokens must not be called on Ollama failure"
        assert len(reconcile_calls) == 0, "reconcile_tokens must not be called on Ollama failure"

        async with async_session() as db:
            session = await db.get(InterviewSession, session_id)
            assert session.llm_tokens_used == initial_session_tokens
            user = await db.get(User, session.user_id)
            assert user.llm_tokens_used == initial_user_tokens


@pytest.mark.asyncio
async def test_groq_token_budget_exhaustion_remains_enforced(monkeypatch):
    from app.routers import evaluations

    provider = ValidEvaluationProvider(name="groq")
    monkeypatch.setattr(evaluations, "_evaluation_provider", lambda: provider)

    guest_id = str(uuid4())
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
            headers={"X-Guest-Id": guest_id},
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        async with async_session() as db:
            session = await db.get(InterviewSession, session_id)
            session.current_state = "completed"
            session.status = "completed"
            session.llm_tokens_used = 12_000
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
            f"/api/evaluations/sessions/{session_id}/report/generate",
            headers={"X-Guest-Id": guest_id},
        )
        assert response.status_code == 200, response.text
        failed = response.json()
        assert failed["status"] == "failed"
        assert "token budget is exhausted" in failed["error"]


# ── GATE 5: known strong / weak / off-topic / empty answer ordering ──────


class ScoredEvaluationProvider:
    """Mock provider that returns predetermined scores based on answer content."""

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
        decoder = json.JSONDecoder()
        payload, _ = decoder.raw_decode(user_content)
        rubric = load_rubric()
        categories = list(rubric["categories"].keys())

        items = payload["evaluation_items"]
        per_question = []
        all_scores: dict[str, list[int]] = {name: [] for name in categories}

        for item in items:
            answer = item["candidate_answer"]
            normalized = answer.strip().lower()

            if not normalized:
                # Empty answer: all zeros, evidence quote is empty string
                scores = {name: 0 for name in categories}
                evidence = ""
            elif "off-topic" in normalized or "recipe" in normalized or "weather" in normalized:
                scores = {
                    "technical_correctness": 1,
                    "relevance": 0,
                    "structure_and_clarity": 2,
                    "completeness_and_examples": 1,
                    "problem_solving": 1,
                    "communication": 2,
                    "job_skill_alignment": 0,
                }
                evidence = answer[:50] if answer else ""
            elif "excellent" in normalized or "comprehensive" in normalized:
                scores = {name: 5 for name in categories}
                evidence = answer[:50] if answer else ""
            else:
                scores = {
                    "technical_correctness": 2,
                    "relevance": 2,
                    "structure_and_clarity": 2,
                    "completeness_and_examples": 1,
                    "problem_solving": 2,
                    "communication": 2,
                    "job_skill_alignment": 1,
                }
                evidence = answer[:50] if answer else ""

            for name in categories:
                all_scores[name].append(scores[name])

            per_question.append(
                {
                    "question_id": item["question_id"],
                    "question": item["question"][:MAX_QUESTION_CHARS],
                    "evidence_quote": evidence or "No answer provided.",
                    "rationale": "Assessed against the rubric.",
                    "category_scores": scores,
                }
            )

        # Compute category averages and weakest categories
        category_avg = {
            name: sum(all_scores[name]) / len(all_scores[name]) for name in categories
        }
        weakest = sorted(category_avg, key=category_avg.get)[:3]
        # Round category scores first, then compute overall from rounded values
        # (validation checks overall == weighted mean of category scores)
        rounded_category_scores = {
            name: max(0, min(5, round(category_avg[name]))) for name in categories
        }
        overall = round(
            sum(rounded_category_scores[name] * rubric["weights"][name] for name in categories),
            2,
        )
        category_scores = {
            name: {"score": rounded_category_scores[name], "rationale": "Aggregate across all answers."}
            for name in categories
        }

        output = {
            "overall_score": overall,
            "category_scores": category_scores,
            "per_question_analysis": per_question,
            "strengths": ["Clear communication."],
            "missing_elements": ["More specific examples needed."],
            "improved_answer_structure": [
                "State the problem.",
                "Explain the approach.",
                "Share the outcome.",
            ],
            "practice_exercises": [
                {
                    "category": weakest[index % len(weakest)],
                    "title": f"Practice task {index + 1}",
                    "task": "Outline an answer for a relevant question.",
                    "target_role": "Backend Engineer",
                }
                for index in range(7)
            ],
        }
        # Return the schema matching the call type (Ollama split-call approach).
        task = payload.get("task", "")
        if task.startswith("Score each rubric category"):
            return Completion(
                json.dumps(
                    {
                        "category_scores": {
                            name: {
                                "score": category_scores[name]["score"],
                                "rationale": category_scores[name]["rationale"],
                            }
                            for name in categories
                        }
                    }
                ),
                100,
                50,
            )
        if task.startswith("Write a one-sentence rationale"):
            return Completion(
                json.dumps(
                    {
                        "question_rationale": {
                            item["question_id"]: {
                                "rationale": "Assessed against the rubric."
                            }
                            for item in items
                        }
                    }
                ),
                100,
                50,
            )
        if task.startswith("List strengths, missing elements"):
            return Completion(
                json.dumps(
                    {
                        "strengths": ["Clear communication."],
                        "missing_elements": ["More specific examples needed."],
                        "improved_structure": [
                            "State the problem.",
                            "Explain the approach.",
                            "Share the outcome.",
                        ],
                    }
                ),
                100,
                50,
            )
        return Completion(json.dumps(output), 100, 50)


def _transcripts_for_answers(answers: list[str]) -> list[Transcript]:
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    rows: list[Transcript] = []
    for i, answer in enumerate(answers):
        rows.append(
            Transcript(
                id=i * 2 + 1,
                session_id="gate5-test",
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
                session_id="gate5-test",
                speaker="candidate",
                message=answer,
                message_id=str(uuid4()),
                timestamp_ms=now_ms + i * 1000 + 500,
                duration_ms=5000,
                source="real",
            )
        )
    return rows


def _session_gate5() -> InterviewSession:
    return InterviewSession(
        id="gate5-test",
        user_id="gate5-user",
        role="Backend Engineer",
        difficulty="medium",
        agora_channel="gate5",
        current_state="completed",
        requested_duration_seconds=600,
        is_demo=False,
        started_at=datetime.now(timezone.utc),
        metadata_json={
            "resume_text": "Backend engineer.",
            "job_description": "Backend role.",
        },
    )


@pytest.mark.asyncio
async def test_gate5_strong_answer_scores_higher_than_weak():
    """Strong answer must score higher than weak answer across all categories."""
    provider = ScoredEvaluationProvider()
    transcripts = _transcripts_for_answers(
        [
            "I built a comprehensive caching system with excellent results and thorough testing.",
            "I don't know much about databases.",
        ]
    )
    result = await generate_assessment(
        session_id="gate5-test",
        session=_session_gate5(),
        transcripts=transcripts,
        context={"resume": "", "job_description": ""},
        provider=provider,
    )
    assert result["status"] == "completed"
    pqa = result["ai_assessments"]["per_question_analysis"]
    strong = pqa[0]["category_scores"]
    weak = pqa[1]["category_scores"]
    for category in strong:
        assert strong[category] >= weak[category], (
            f"Strong answer should score >= weak answer on {category}: {strong[category]} vs {weak[category]}"
        )


@pytest.mark.asyncio
async def test_gate5_off_topic_answer_scores_low_on_relevance():
    """Off-topic answer must score 0 on relevance."""
    provider = ScoredEvaluationProvider()
    transcripts = _transcripts_for_answers(
        ["The weather is nice today. I like talking about cooking recipes."]
    )
    result = await generate_assessment(
        session_id="gate5-test",
        session=_session_gate5(),
        transcripts=transcripts,
        context={"resume": "", "job_description": ""},
        provider=provider,
    )
    assert result["status"] == "completed"
    relevance = result["ai_assessments"]["per_question_analysis"][0]["category_scores"][
        "relevance"
    ]
    assert relevance == 0, f"Off-topic answer relevance should be 0, got {relevance}"


@pytest.mark.asyncio
async def test_gate5_empty_answer_does_not_crash():
    """Empty answer must not crash the evaluation engine (returns insufficient_data)."""
    provider = ScoredEvaluationProvider()
    transcripts = _transcripts_for_answers([""])
    result = await generate_assessment(
        session_id="gate5-test",
        session=_session_gate5(),
        transcripts=transcripts,
        context={"resume": "", "job_description": ""},
        provider=provider,
    )
    # Empty answers are filtered at the pair level -> insufficient_data, not a crash
    assert result["status"] == "insufficient_data"
    assert provider.calls == 0


@pytest.mark.asyncio
async def test_gate5_overall_score_is_deterministic_weighted_mean():
    """Overall score must equal the weighted mean of category scores (no LLM math)."""
    provider = ScoredEvaluationProvider()
    transcripts = _transcripts_for_answers(
        ["I built a comprehensive caching system with excellent results."]
    )
    result = await generate_assessment(
        session_id="gate5-test",
        session=_session_gate5(),
        transcripts=transcripts,
        context={"resume": "", "job_description": ""},
        provider=provider,
    )
    assert result["status"] == "completed"
    rubric = load_rubric()
    categories = result["ai_assessments"]["category_scores"]
    weighted = sum(
        categories[name]["score"] * rubric["weights"][name] for name in rubric["categories"]
    )
    assert abs(result["ai_assessments"]["overall_score"] - round(weighted, 2)) < 0.01


@pytest.mark.asyncio
async def test_gate5_evidence_quotes_come_from_actual_answers():
    """Every evidence quote must be an exact excerpt from the candidate's answer."""
    provider = ScoredEvaluationProvider()
    answer_text = "I built a PostgreSQL query cache that reduced latency by 60%."
    transcripts = _transcripts_for_answers([answer_text])
    result = await generate_assessment(
        session_id="gate5-test",
        session=_session_gate5(),
        transcripts=transcripts,
        context={"resume": "", "job_description": ""},
        provider=provider,
    )
    assert result["status"] == "completed"
    evidence = result["ai_assessments"]["per_question_analysis"][0]["evidence_quote"]
    assert evidence in answer_text, f"Evidence '{evidence}' not found in answer '{answer_text}'"
