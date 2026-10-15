"""Pytest configuration for VoiceHire API tests."""
import asyncio
import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ["APP_ENV"] = "development"
os.environ["DEMO_MODE"] = "true"
os.environ["OPENAI_API_KEY"] = "test-only-openai-placeholder-not-a-secret"
os.environ["CLERK_SECRET_KEY"] = "test-only-clerk-placeholder-not-a-secret"
_test_database_dir = tempfile.TemporaryDirectory(prefix="voicehire-tests-")
_test_database_path = Path(_test_database_dir.name) / "voicehire.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_test_database_path.as_posix()}"


@pytest.fixture(scope="session")
def event_loop():
    """Create a new event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True)
async def _init_db():
    """Initialize the test database before tests, and clean up after."""
    from app.database import init_db, close_db
    await init_db()
    yield
    await close_db()
