from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.auth import _DEMO_USER, _upsert_user


@pytest.mark.asyncio
async def test_upsert_user_fails_when_database_write_fails():
    db = AsyncMock()
    db.execute.side_effect = SQLAlchemyError("database unavailable")

    with pytest.raises(HTTPException) as error:
        await _upsert_user(_DEMO_USER, db)

    assert error.value.status_code == 503
    assert error.value.detail == "User persistence unavailable"
    db.rollback.assert_awaited_once()
