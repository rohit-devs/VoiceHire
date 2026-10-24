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


@pytest.mark.asyncio
async def test_readiness_reports_optional_services_without_exposing_credentials(monkeypatch):
    from app.config import settings

    secret = "gsk_test_do_not_return_this_secret"
    monkeypatch.setattr(settings, "GROQ_API_KEY", secret)
    monkeypatch.setattr(settings, "DEEPGRAM_API_KEY", "deepgram-test-key-that-is-valid")
    monkeypatch.setattr(settings, "AGORA_APP_ID", "")
    monkeypatch.setattr(settings, "AGORA_APP_CERTIFICATE", "")

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://localhost",
    ) as client:
        response = await client.get("/api/health/ready")
        live = await client.get("/api/health/live")

    assert response.status_code == 200
    payload = response.json()
    assert payload["dependencies"]["database"]["status"] == "ok"
    assert payload["dependencies"]["groq"]["status"] == "ok"
    assert payload["dependencies"]["deepgram"]["status"] == "ok"
    assert payload["dependencies"]["redis"]["status"] == "disabled"
    assert payload["dependencies"]["agora"]["status"] == "disabled"
    assert secret not in response.text
    assert live.status_code == 200
    assert live.json()["status"] == "alive"


def test_optional_service_configuration_is_degraded_when_incomplete(monkeypatch):
    from app.config import settings
    from app.routers.health import _dependency_status

    monkeypatch.setattr(settings, "AGORA_APP_ID", "partially-configured")
    monkeypatch.setattr(settings, "AGORA_APP_CERTIFICATE", "")
    assert _dependency_status(settings.agora_enabled, True)["status"] == "error"


@pytest.mark.asyncio
async def test_readiness_marks_partial_provider_keys_as_errors(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "short")
    monkeypatch.setattr(settings, "DEEPGRAM_API_KEY", "")

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://localhost",
    ) as client:
        response = await client.get("/api/health/ready")

    assert response.status_code == 200
    dependencies = response.json()["dependencies"]
    assert dependencies["groq"]["status"] == "error"
    assert dependencies["deepgram"]["status"] == "disabled"