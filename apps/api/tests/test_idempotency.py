import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


@pytest.mark.asyncio
async def test_session_lifecycle_and_report_replay_idempotent_responses(monkeypatch):
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        created = await client.post(
            "/api/interviews/sessions", json={"role": "Engineer"}
        )
        assert created.status_code == 200, created.text
        session_id = created.json()["id"]

        start_url = f"/api/interviews/sessions/{session_id}/start"
        started = await client.post(start_url, headers={"Idempotency-Key": "start-1"})
        replayed_start = await client.post(
            start_url, headers={"Idempotency-Key": "start-1"}
        )
        assert started.status_code == 200, started.text
        assert replayed_start.json() == started.json()

        end_url = f"/api/interviews/sessions/{session_id}/end"
        ended = await client.post(end_url, headers={"Idempotency-Key": "end-1"})
        replayed_end = await client.post(end_url, headers={"Idempotency-Key": "end-1"})
        assert ended.status_code == 200, ended.text
        assert replayed_end.json() == ended.json()

        report_url = f"/api/evaluations/sessions/{session_id}/report/generate"
        report = await client.post(
            report_url, headers={"Idempotency-Key": "report-1"}
        )
        replayed_report = await client.post(
            report_url, headers={"Idempotency-Key": "report-1"}
        )
        assert report.status_code == 200, report.text
        assert replayed_report.json() == report.json()
