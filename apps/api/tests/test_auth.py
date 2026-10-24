"""
Regression tests for anonymous guest identity and authorization.

Covers:
- Guest identity without credentials -> 200 (demo mode)
- Guest identity with X-Guest-Id header -> 200
- Invalid X-Guest-Id -> 400
- Cross-guest access -> 403
- Session ownership enforced server-side
"""
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from app.config import settings
from app.database import async_session
from app.main import app
from app.models import InterviewSession, User


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://localhost") as client:
        yield client


@pytest_asyncio.fixture(autouse=True)
async def ensure_demo_mode():
    """Ensure DEMO_MODE is True for these tests."""
    original_demo_mode = settings.DEMO_MODE
    settings.DEMO_MODE = True
    yield
    settings.DEMO_MODE = original_demo_mode


class TestGuestIdentity:
    """Anonymous guest identity resolution."""

    @pytest.mark.asyncio
    async def test_create_session_without_guest_id_demo(self, client):
        """In demo mode, creating a session without a guest ID should return 200."""
        response = await client.post(
            "/api/interviews/sessions",
            json={"role": "Backend Engineer", "difficulty": "medium"},
        )
        assert response.status_code in (200, 201), response.text
        data = response.json()
        assert data["id"]
        assert data["agora_channel"].startswith("vh-")
        assert data["role"] == "Backend Engineer"
        assert data["status"] == "created"

    @pytest.mark.asyncio
    async def test_create_session_with_valid_guest_id_header(self, client):
        """A valid X-Guest-Id header (UUID v4) should be accepted."""
        guest_id = str(uuid.uuid4())
        response = await client.post(
            "/api/interviews/sessions",
            json={"role": "Backend Engineer", "difficulty": "medium"},
            headers={"X-Guest-Id": guest_id},
        )
        assert response.status_code in (200, 201), response.text

        # Verify the user row was created with this guest_id
        db = async_session()
        try:
            result = await db.execute(
                text("SELECT id, guest_id FROM users WHERE guest_id = :gid"),
                {"gid": guest_id},
            )
            row = result.first()
            assert row is not None
            assert row.guest_id == guest_id
        finally:
            await db.close()

    @pytest.mark.asyncio
    async def test_create_session_with_invalid_guest_id_header(self, client):
        """An invalid X-Guest-Id should be rejected."""
        response = await client.post(
            "/api/interviews/sessions",
            json={"role": "Backend Engineer", "difficulty": "medium"},
            headers={"X-Guest-Id": "not-a-uuid"},
        )
        assert response.status_code == 400, response.text

    @pytest.mark.asyncio
    async def test_get_current_user_profile_guest(self, client):
        """The /users/me endpoint should return the guest user."""
        response = await client.get("/api/users/me")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["id"]

    @pytest.mark.asyncio
    async def test_update_profile_background_role_and_preferences(self, client):
        response = await client.put(
            "/api/users/me",
            json={
                "first_name": "Guest",
                "last_name": "Candidate",
                "target_role": "Backend Engineer",
                "background": "Built reliable async APIs.",
                "default_interview_persona": "technical_lead",
                "default_interview_difficulty": "hard",
            },
        )
        assert response.status_code == 200, response.text
        assert response.json()["target_role"] == "Backend Engineer"
        assert response.json()["background"] == "Built reliable async APIs."
        assert response.json()["default_interview_difficulty"] == "hard"


class TestGuestOwnership:
    """Cross-guest access should be denied with 403."""

    @pytest.mark.asyncio
    async def test_get_session_other_guest_forbidden(self, client):
        """A guest should not be able to access another guest's session."""
        session_id = str(uuid.uuid4())
        other_guest_id = str(uuid.uuid4())

        db = async_session()
        try:
            db.add(
                User(
                    id=other_guest_id,
                    guest_id=other_guest_id,
                    email=f"{other_guest_id}@example.test",
                    first_name="Other",
                    last_name="Guest",
                )
            )
            await db.flush()
            db.add(
                InterviewSession(
                    id=session_id,
                    user_id=other_guest_id,
                    role="Engineer",
                    difficulty="medium",
                    status="created",
                    current_state="created",
                    agora_channel=f"vh-{session_id[:8]}",
                    persona="technical",
                    metadata_json={},
                )
            )
            await db.commit()
        finally:
            await db.close()

        # Current guest tries to access other guest's session
        response = await client.get(f"/api/interviews/sessions/{session_id}")
        assert response.status_code == 403, response.text
        transcript_response = await client.get(
            f"/api/interviews/sessions/{session_id}/transcript"
        )
        assert transcript_response.status_code == 403, transcript_response.text
        report_response = await client.get(
            f"/api/evaluations/sessions/{session_id}/report"
        )
        assert report_response.status_code == 403, report_response.text
        coaching_response = await client.get(
            f"/api/evaluations/sessions/{session_id}/coaching-plan"
        )
        assert coaching_response.status_code == 403, coaching_response.text

        # Cleanup
        db = async_session()
        try:
            session = await db.get(InterviewSession, session_id)
            if session:
                await db.delete(session)
            other_user = await db.get(User, other_guest_id)
            if other_user:
                await db.delete(other_user)
            await db.commit()
        finally:
            await db.close()
