from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.auth import _upsert_guest_user


@pytest.mark.asyncio
async def test_upsert_guest_user_fails_when_database_write_fails():
    db = AsyncMock()
    db.scalar.side_effect = SQLAlchemyError("database unavailable")

    with pytest.raises(HTTPException) as error:
        await _upsert_guest_user("demo-user-001", db)

    assert error.value.status_code == 503
    assert error.value.detail == "User persistence unavailable"
    db.rollback.assert_awaited_once()
