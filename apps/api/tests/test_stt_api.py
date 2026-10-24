import pytest
from httpx import ASGITransport, AsyncClient
from uuid import uuid4

from app.main import app
from app.routers import stt


class MockSTTProvider:
    name = "deepgram"
    model = "nova-3"

    async def transcribe(self, audio: bytes, content_type: str) -> str:
        assert audio == b"audio-bytes"
        assert content_type == "audio/webm"
        return "I improved service reliability."


@pytest.mark.asyncio
async def test_recorded_audio_endpoint_uses_selected_provider(monkeypatch):
    monkeypatch.setattr(stt, "get_stt_provider", MockSTTProvider)
    guest_id = str(uuid4())
    headers = {"X-Guest-Id": guest_id}
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://localhost",
    ) as client:
        created = await client.post(
            "/api/interviews/sessions",
            json={
                "role": "Backend Engineer",
                "resume_text": "Built reliable backend services.",
                "job_description": "Improve backend service reliability.",
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
            f"/api/stt/transcribe?session_id={session_id}",
            files={"audio": ("answer.webm", b"audio-bytes", "audio/webm")},
            headers=headers,
        )

    assert response.status_code == 200, response.text
    assert response.json() == {
        "text": "I improved service reliability.",
        "provider": "deepgram",
        "model": "nova-3",
    }
