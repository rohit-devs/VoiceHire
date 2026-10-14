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
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from app.config import settings
from app.database import async_session
from app.main import app
from app.auth import _DEMO_USER
from app.models import InterviewSession, User


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://localhost") as client:
        yield client


@pytest_asyncio.fixture(autouse=True)
async def reset_demo_mode():
    """Ensure DEMO_MODE is True for these tests."""
    original_demo_mode = settings.DEMO_MODE
    original_clerk_secret = settings.CLERK_SECRET_KEY
    settings.DEMO_MODE = True
    settings.CLERK_SECRET_KEY = "sk_test_placeholder_key_placeholder_placeholder"
    yield
    settings.DEMO_MODE = original_demo_mode
    settings.CLERK_SECRET_KEY = original_clerk_secret


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
        data = response.json()
        assert data["id"]
        assert data["agora_channel"].startswith("vh-")
        assert data["role"] == "Backend Engineer"
        assert data["status"] == "scheduled"

    @pytest.mark.asyncio
    async def test_create_session_persists_demo_user_ownership(self, client):
        """Created sessions are persisted for the authenticated demo user."""
        response = await client.post(
            "/api/interviews/sessions",
            json={"role": "Platform Engineer", "difficulty": "hard"},
        )
        assert response.status_code == 200, response.text
        session = response.json()

        db = async_session()
        try:
            result = await db.execute(
                text(
                    "SELECT id, user_id, role, difficulty, agora_channel "
                    "FROM interview_sessions WHERE id = :id"
                ),
                {"id": session["id"]},
            )
            row = result.first()
            assert row is not None
            assert row.id == session["id"]
            assert row.user_id == _DEMO_USER["id"]
            assert row.role == "Platform Engineer"
            assert row.difficulty == "hard"
            assert row.agora_channel == session["agora_channel"]
        finally:
            await db.execute(
                text("DELETE FROM interview_sessions WHERE id = :id"),
                {"id": session["id"]},
            )
            await db.commit()
            await db.close()

    @pytest.mark.asyncio
    async def test_create_session_invalid_request_returns_422(self, client):
        """Missing required request data is rejected by Pydantic validation."""
        response = await client.post("/api/interviews/sessions", json={})
        assert response.status_code == 422, response.text

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
            db.add(
                User(
                    id=other_user_id,
                    clerk_id=other_user_id,
                    email=f"{other_user_id}@example.test",
                    first_name="Other",
                    last_name="User",
                )
            )
            await db.flush()
            db.add(
                InterviewSession(
                    id=session_id,
                    user_id=other_user_id,
                    role="Engineer",
                    difficulty="medium",
                    status="scheduled",
                    current_state="intro",
                    agora_channel=f"vh-{session_id[:8]}",
                    persona="technical",
                    metadata_json={},
                )
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
            session = await db.get(InterviewSession, session_id)
            if session:
                await db.delete(session)
            other_user = await db.get(User, other_user_id)
            if other_user:
                await db.delete(other_user)
            await db.commit()
        finally:
            await db.close()
