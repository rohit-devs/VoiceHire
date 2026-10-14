from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings
from app.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _resolved_database_url() -> str:
    url = settings.DATABASE_URL
    if settings.is_postgres and url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if not settings.is_postgres and not url.startswith("sqlite"):
        return "sqlite+aiosqlite:///./voicehire_demo.db"
    return url


config.set_main_option("sqlalchemy.url", _resolved_database_url().replace("%", "%%"))


def do_run_migrations(connection) -> None:
    def include_object(object_, name, type_, reflected, compare_to):
        if (
            type_ == "index"
            and name == "ix_job_descriptions_embedding"
            and connection.dialect.name != "postgresql"
        ):
            return False
        return True

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        render_as_batch=connection.dialect.name == "sqlite",
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    injected_connection = config.attributes.get("connection")
    if injected_connection is not None:
        do_run_migrations(injected_connection)
    else:
        asyncio.run(run_async_migrations())
