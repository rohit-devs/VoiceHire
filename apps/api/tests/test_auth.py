"""
Regression tests for authentication and authorization.

Covers:
- Unauthenticated requests -> 401
- Invalid token -> 401 (in non-demo mode)
- Valid demo user -> 200 (in demo mode)
- Cross-user access -> 403
"""
import uuid

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from app.config import settings
from app.database import async_session
from app.main import app
from app.auth import _DEMO_USER


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://localhost") as client:
        yield client


@pytest.fixture(autouse=True)
async def reset_demo_mode():
    """Ensure DEMO_MODE is True for these tests."""
    settings.DEMO_MODE = True
    settings.CLERK_SECRET_KEY = "sk_test_placeholder_key_placeholder_placeholder"
    yield


class TestAuthDemoMode:
    """When DEMO_MODE=True, requests without a token should succeed."""

    @pytest.mark.asyncio
    async def test_create_session_without_token_demo(self, client):
        """In demo mode, creating a session without a Bearer token should return 200/201."""
        response = await client.post(
            "/api/interviews/sessions",
            json={"role": "Backend Engineer", "difficulty": "medium"},
        )
        assert response.status_code in (200, 201), response.text

    @pytest.mark.asyncio
    async def test_create_session_with_invalid_token_demo(self, client):
        """In demo mode, an invalid Bearer token should still work (fallback to demo user)."""
        response = await client.post(
            "/api/interviews/sessions",
            json={"role": "Backend Engineer", "difficulty": "medium"},
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code in (200, 201), response.text

    @pytest.mark.asyncio
    async def test_get_current_user_profile_demo(self, client):
        """The /users/me endpoint should return the demo user in demo mode."""
        response = await client.get("/api/users/me")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["email"] == _DEMO_USER["email"]


class TestAuthNonDemoMode:
    """When DEMO_MODE=False, valid Bearer tokens are required."""

    @pytest.fixture(autouse=True)
    async def _set_non_demo(self):
        settings.DEMO_MODE = False
        yield
        settings.DEMO_MODE = True

    @pytest.mark.asyncio
    async def test_create_session_without_token_non_demo(self, client):
        """In non-demo mode, no token -> 401."""
        response = await client.post(
            "/api/interviews/sessions",
            json={"role": "Backend Engineer", "difficulty": "medium"},
        )
        assert response.status_code == 401, response.text

    @pytest.mark.asyncio
    async def test_create_session_with_invalid_token_non_demo(self, client):
        """In non-demo mode, invalid token -> 401."""
        response = await client.post(
            "/api/interviews/sessions",
            json={"role": "Backend Engineer", "difficulty": "medium"},
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401, response.text

    @pytest.mark.asyncio
    async def test_users_me_without_token_non_demo(self, client):
        """In non-demo mode, /users/me without token -> 401."""
        response = await client.get("/api/users/me")
        assert response.status_code == 401, response.text


class TestOwnership:
    """Cross-user access should be denied with 403."""

    @pytest.mark.asyncio
    async def test_get_session_other_user_forbidden(self, client):
        """A user should not be able to access another user's session."""
        session_id = str(uuid.uuid4())
        other_user_id = "other-user-999"

        db = async_session()
        try:
            await db.execute(
                text(
                    "INSERT INTO interview_sessions "
                    "(id, user_id, role, difficulty, status, current_state, agora_channel, persona, metadata) "
                    "VALUES (:id, :user_id, :role, :difficulty, :status, :current_state, :agora_channel, :persona, :metadata)"
                ),
                {
                    "id": session_id,
                    "user_id": other_user_id,
                    "role": "Engineer",
                    "difficulty": "medium",
                    "status": "scheduled",
                    "current_state": "intro",
                    "agora_channel": f"vh-{session_id[:8]}",
                    "persona": "technical",
                    "metadata": "{}",
                },
            )
            await db.commit()
        finally:
            await db.close()

        # Demo user tries to access other user's session
        response = await client.get(f"/api/interviews/sessions/{session_id}")
        assert response.status_code == 403, response.text

        # Cleanup
        db = async_session()
        try:
            await db.execute(
                text("DELETE FROM interview_sessions WHERE id = :id"),
                {"id": session_id},
            )
            await db.commit()
        finally:
            await db.close()
