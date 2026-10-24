from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import event, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import init_db
from app.idempotency import cached_response
from app.models import IdempotencyRecord, InterviewSession, User


API_DIR = Path(__file__).resolve().parents[1]


def _migrate(connection, direction: str, revision: str) -> None:
    config = Config(str(API_DIR / "alembic.ini"))
    config.attributes["connection"] = connection
    getattr(command, direction)(config, revision)


def _test_engine(database_path: Path):
    url = f"sqlite+aiosqlite:///{database_path.as_posix()}"
    engine = create_async_engine(url)

    @event.listens_for(engine.sync_engine, "connect")
    def _enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


@pytest.mark.asyncio
async def test_initial_migration_up_and_down_on_fresh_sqlite(tmp_path):
    engine = _test_engine(tmp_path / "migration.db")
    try:
        async with engine.connect() as connection:
            await connection.run_sync(lambda sync: _migrate(sync, "upgrade", "head"))
            tables_after_upgrade = await connection.run_sync(
                lambda sync: set(inspect(sync).get_table_names())
            )
            assert {"users", "interview_sessions", "idempotency_records"} <= tables_after_upgrade

            await connection.run_sync(lambda sync: _migrate(sync, "downgrade", "base"))
            tables_after_downgrade = await connection.run_sync(
                lambda sync: set(inspect(sync).get_table_names())
            )
            assert "users" not in tables_after_downgrade
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_init_db_migrates_empty_sqlite_to_working_schema(tmp_path):
    engine = _test_engine(tmp_path / "init-db.db")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        await init_db(engine)
        async with sessions() as db:
            user = User(
                id="migration-user",
                guest_id="migration-user-guest",
                email="migration-user@example.test",
            )
            db.add(user)
            await db.flush()
            db.add(
                InterviewSession(
                    id=str(uuid4()),
                    user_id=user.id,
                    role="Engineer",
                    difficulty="medium",
                    agora_channel=f"vh-{uuid4().hex[:8]}",
                )
            )
            await db.commit()
            assert await db.scalar(
                select(User.id).where(User.id == "migration-user")
            ) == "migration-user"
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_schema_constraints_and_idempotency_key_uniqueness(tmp_path):
    engine = _test_engine(tmp_path / "constraints.db")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        await init_db(engine)
        async with sessions() as db:
            db.add(
                User(
                    id="constraint-user",
                    guest_id="constraint-guest",
                    email="constraint@example.test",
                )
            )
            await db.commit()

            db.add(
                User(
                    id="duplicate-user",
                    guest_id="constraint-guest",
                    email="duplicate@example.test",
                )
            )
            with pytest.raises(IntegrityError):
                await db.commit()
            await db.rollback()

            db.add(
                InterviewSession(
                    id="invalid-status",
                    user_id="constraint-user",
                    role="Engineer",
                    difficulty="medium",
                    status="unknown",
                    agora_channel="invalid-status",
                )
            )
            with pytest.raises(IntegrityError):
                await db.commit()
            await db.rollback()

            record = IdempotencyRecord(
                user_id="constraint-user",
                operation="session.start:session-1",
                idempotency_key="request-1",
                resource_id="session-1",
                response_data={"status": "started"},
            )
            db.add(record)
            await db.commit()
            assert await cached_response(
                db, "constraint-user", "session.start:session-1", "request-1"
            ) == {"status": "started"}

            db.add(
                IdempotencyRecord(
                    user_id="constraint-user",
                    operation="session.start:session-1",
                    idempotency_key="request-1",
                    resource_id="session-1",
                    response_data={"status": "started"},
                )
            )
            with pytest.raises(IntegrityError):
                await db.commit()
    finally:
        await engine.dispose()
