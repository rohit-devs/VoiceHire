# Database setup and schema ownership

## Schema owner

SQLAlchemy models in `apps/api/app/models.py` and Alembic migrations in `apps/api/alembic/` are the only authoritative backend schema. The web app contains no `@prisma/client` imports. The unused Prisma-only `packages/database` package and the manually maintained `databases/schema.sql` were removed because they duplicated a schema the API did not use and had already drifted (for example, key types and table constraints differed).

## Setup and upgrades

From `apps/api`, install the API package and run the single migration command:

```powershell
python -m pip install -e ".[dev]"
alembic upgrade head
```

The same migration is applied on API startup by `init_db`; migration errors are fatal rather than silently ignored. SQLite is used by default for local demo mode. PostgreSQL uses `DATABASE_URL` and the pgvector extension supplied by the `pgvector/pgvector` image in `docker-compose.yml`.

For a fresh local PostgreSQL service:

```powershell
docker compose up -d postgres
Set-Location apps/api
alembic upgrade head
```

Existing databases created by the deleted handwritten schema are not automatically stamped as migrated. Back them up and plan an explicit data-preserving migration before adopting Alembic; do not run the initial migration against a populated legacy database.

## Demo seed

`python -m app.seed_demo` inserts only the explicitly labeled `demo-user-001` record and only when `DEMO_MODE` is true. The command aborts in non-demo mode. The seed is not run by migrations, installation, CI, or production startup.

## Redis

The API has no Redis client, cache, session store, or rate limiter. Redis was removed from API dependencies and local Compose wiring. Interview orchestration remains in-process; it is not backed by Redis and does not have Redis failover semantics.
