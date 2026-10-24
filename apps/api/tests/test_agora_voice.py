from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from starlette.websockets import WebSocketDisconnect

from app.agora import tokens as agora
from app.config import settings
from app.database import async_session
from app.main import app
from app.models import Transcript
from app.websocket_manager import connection_manager


def test_agora_token_uses_absolute_expiry_and_rejects_long_lifetime(monkeypatch):
    observed = {}

    def build_token(app_id, certificate, channel, uid, role, expiration):
        observed.update(
            app_id=app_id,
            certificate=certificate,
            channel=channel,
            uid=uid,
            role=role,
            expiration=expiration,
        )
        return "signed-token"

    monkeypatch.setattr(agora.time, "time", lambda: 10_000)
    monkeypatch.setattr(agora.RtcTokenBuilder, "buildTokenWithUid", build_token)
    monkeypatch.setattr(settings, "AGORA_APP_ID", "a" * 32)
    monkeypatch.setattr(settings, "AGORA_APP_CERTIFICATE", "server-only")

    assert agora.generate_agora_token("vh-session", 1, expire_seconds=3600) == "signed-token"
    assert observed["expiration"] == 13_600
    assert observed["certificate"] == "server-only"
    with pytest.raises(ValueError, match="within one hour"):
        agora.generate_agora_token("vh-session", 1, expire_seconds=3601)


@pytest.mark.asyncio
async def test_token_is_limited_to_owned_interview_session_and_session_channel(monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(settings, "AGORA_APP_ID", "a" * 32)
    monkeypatch.setattr(settings, "AGORA_APP_CERTIFICATE", "server-only")
    monkeypatch.setattr(settings, "AGORA_TOKEN_EXPIRATION", 7200)
    calls = []
    guest_id = str(uuid4())
    headers = {"X-Guest-Id": guest_id}

    def fake_token(channel_name, uid, role, expire_seconds):
        calls.append((channel_name, uid, role, expire_seconds))
        return "signed-token"

    monkeypatch.setattr("app.routers.agora.generate_agora_token", fake_token)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        created = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built Python APIs.",
                "job_category": "backend engineering",
                "is_demo": True,
                "duration_seconds": 300,
            },
            headers=headers,
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        before_start = await client.post(
            "/api/agora/token", json={"session_id": session_id}, headers=headers
        )
        assert before_start.status_code == 409

        started = await client.post(
            f"/api/interviews/sessions/{session_id}/start", headers=headers
        )
        assert started.status_code == 200, started.text
        response = await client.post(
            "/api/agora/token",
            json={"session_id": session_id, "channel_name": "attacker-channel"},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        assert response.json() == {
            "token": "signed-token",
            "channel_name": created.json()["agora_channel"],
            "uid": 1,
            "app_id": "a" * 32,
            "expires_in_seconds": 3600,
        }
        assert calls == [(created.json()["agora_channel"], 1, "publisher", 3600)]
        assert "certificate" not in response.json()

        missing = await client.post(
            "/api/agora/token", json={"session_id": str(uuid4())}, headers=headers
        )
        assert missing.status_code == 404


@pytest.mark.asyncio
async def test_missing_agora_credentials_returns_text_fallback_error(monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    monkeypatch.setattr(settings, "AGORA_APP_ID", "")
    monkeypatch.setattr(settings, "AGORA_APP_CERTIFICATE", "")
    guest_id = str(uuid4())
    headers = {"X-Guest-Id": guest_id}
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        created = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built Python APIs.",
                "job_category": "backend engineering",
                "is_demo": True,
            },
            headers=headers,
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]
        started = await client.post(
            f"/api/interviews/sessions/{session_id}/start", headers=headers
        )
        assert started.status_code == 200, started.text
        response = await client.post(
            "/api/agora/token", json={"session_id": session_id}, headers=headers
        )
        assert response.status_code == 503
        assert "continue with text input" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_duplicate_final_segment_is_persisted_and_broadcast_once(monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    message_id = str(uuid4())
    candidate_broadcasts = []
    metrics_broadcasts = []
    guest_id = str(uuid4())
    headers = {"X-Guest-Id": guest_id}

    async def record_broadcast(session_id, message):
        if message.get("type") == "transcript" and message.get("speaker") == "candidate":
            candidate_broadcasts.append((session_id, message))
        if message.get("type") == "voice_metrics":
            metrics_broadcasts.append((session_id, message))

    monkeypatch.setattr(connection_manager, "broadcast_transcript", record_broadcast)
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        created = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built Python APIs.",
                "job_category": "backend engineering",
                "is_demo": True,
                "duration_seconds": 300,
            },
            headers=headers,
        )
        session_id = created.json()["id"]
        started = await client.post(
            f"/api/interviews/sessions/{session_id}/start", headers=headers
        )
        assert started.status_code == 200, started.text
        answer = {
            "speaker": "candidate",
            "message": "Um, I built a Python API.",
            "message_id": message_id,
            "duration_ms": 4000,
            "language": "en",
        }
        first = await client.post(
            f"/api/interviews/sessions/{session_id}/transcript", json=answer, headers=headers
        )
        duplicate = await client.post(
            f"/api/interviews/sessions/{session_id}/transcript", json=answer, headers=headers
        )
        assert first.status_code == 200, first.text
        assert duplicate.status_code == 200, duplicate.text
        assert duplicate.json()["idempotent"] is True
        assert duplicate.json()["message_id"] == message_id
        assert first.json()["sequence_number"] == duplicate.json()["sequence_number"]
        assert len(candidate_broadcasts) == 1
        assert len(metrics_broadcasts) == 1
        assert metrics_broadcasts[0][1]["source"] == "simulated"
        assert metrics_broadcasts[0][1]["timestamp_ms"] > 0

        async with async_session() as db:
            rows = list(
                (
                    await db.scalars(
                        select(Transcript).where(Transcript.message_id == message_id)
                    )
                ).all()
            )
            assert len(rows) == 1


def test_websocket_replays_final_segments_and_rejects_other_users(monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    other_guest_id = str(uuid4())
    guest_id = str(uuid4())
    headers = {"X-Guest-Id": guest_id}
    with TestClient(app, base_url="http://localhost") as client:
        created = client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built Python APIs.",
                "job_category": "backend engineering",
                "is_demo": True,
                "duration_seconds": 300,
            },
            headers=headers,
        )
        assert created.status_code == 200, created.text
        demo_session_id = created.json()["id"]
        started = client.post(
            f"/api/interviews/sessions/{demo_session_id}/start", headers=headers
        )
        assert started.status_code == 200, started.text
        with client.websocket_connect(
            f"/api/interviews/sessions/{demo_session_id}/ws?after_sequence=0",
            headers={"host": "localhost"},
        ) as websocket:
            replayed = websocket.receive_json()
            assert replayed["type"] == "transcript"
            assert replayed["speaker"] == "interviewer"
            assert replayed["message_id"]
            assert replayed["sequence_number"] > 0
            assert replayed["timestamp_ms"] > 0

        other = client.post(
            "/api/interviews/sessions",
            headers={"X-Guest-Id": other_guest_id},
            json={
                "role": "Engineer",
                "resume_text": "Built Python APIs.",
                "job_category": "backend engineering",
                "duration_seconds": 300,
            },
        )
        assert other.status_code == 200, other.text
        other_session_id = other.json()["id"]
        assert other.json()["is_demo"] is False
        report_response = client.get(
            f"/api/evaluations/sessions/{other_session_id}/report",
            headers={"X-Guest-Id": other_guest_id},
        )
        assert report_response.status_code == 404
        assert "not been generated" in report_response.json()["detail"]
        reports_response = client.get(
            "/api/evaluations/user/reports",
            headers={"X-Guest-Id": other_guest_id},
        )
        assert reports_response.json()["reports"] == []
        assert "confidence_score" not in reports_response.text

        with pytest.raises(WebSocketDisconnect) as closed:
            with client.websocket_connect(
                f"/api/interviews/sessions/{other_session_id}/ws?token=valid",
                headers={"host": "localhost"},
            ):
                pass
        assert closed.value.code == 1008
