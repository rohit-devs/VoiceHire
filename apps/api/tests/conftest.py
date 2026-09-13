"""Pytest configuration for VoiceHire API tests."""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ["NODE_ENV"] = "development"
os.environ["OPENAI_API_KEY"] = "sk-test-fake-key-for-testing-only-min-20-chars"
os.environ["CLERK_PUBLISHABLE_KEY"] = "pk_test_fake"
os.environ["CLERK_SECRET_KEY"] = "sk_test_fake_placeholder_key_placeholder_placeholder"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_voicehire.db"


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
