import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


@pytest.mark.asyncio
@pytest.mark.parametrize(("demo_mode", "expected_mode"), [(True, "demo"), (False, "live")])
async def test_health_responses_report_configured_mode(monkeypatch, demo_mode, expected_mode):
    monkeypatch.setattr(settings, "DEMO_MODE", demo_mode)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://localhost",
    ) as client:
        root = await client.get("/")
        health = await client.get("/healthz")

    assert root.status_code == 200
    assert root.json()["mode"] == expected_mode
    assert health.status_code == 200
    assert health.json()["mode"] == expected_mode