"""Async SQLAlchemy engine and Alembic-backed database lifecycle."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import settings


def _database_url() -> str:
    url = settings.DATABASE_URL
    if settings.is_postgres and url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if not settings.is_postgres and not url.startswith("sqlite"):
        return "sqlite+aiosqlite:///./voicehire_demo.db"
    return url


engine = create_async_engine(_database_url(), echo=False)


if engine.url.get_backend_name() == "sqlite":
    @event.listens_for(engine.sync_engine, "connect")
    def _enable_sqlite_foreign_keys(connection, _record) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    """FastAPI dependency that yields a transaction-capable async session."""
    session = async_session()
    try:
        yield session
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


def _run_upgrade(connection) -> None:
    config_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    config = Config(str(config_path))
    config.attributes["connection"] = connection
    command.upgrade(config, "head")


async def init_db(target_engine: AsyncEngine = engine) -> None:
    """Apply pending Alembic migrations; failures prevent the API from starting."""
    async with target_engine.connect() as connection:
        await connection.run_sync(_run_upgrade)


async def close_db() -> None:
    await engine.dispose()
