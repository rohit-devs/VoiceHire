# Implementation Checklist and Baseline

Baseline recorded on 2026-10-14 on branch `feat/finish-voicehire`.

## Feature inventory

### Implemented and verified

- Next.js App Router pages type-check, lint, build, and serve the home page.
- FastAPI starts against local SQLite. `/api/health/ready`, `/api/health/live`, and `/` return HTTP 200.
- API root and `/healthz` report the configured demo/live mode. Tests cover both values.
- API tests cover demo auth behavior, session ownership, and failed user persistence.
- Demo-mode banner labels sample scores as non-real measurements in the frontend.
- The pnpm workspace discovers the web, API script package, database, and prompts workspaces.
- Frontend `apps/web/lib` files are tracked; a targeted scan of all six files found no matching hardcoded secret patterns.
- SQLAlchemy models and Alembic migrations are the backend schema authority; the web app does not import Prisma Client, so the unused Prisma package and duplicate handwritten SQL schema were removed.
- The initial Alembic migration creates the schema on fresh SQLite, downgrades cleanly, and reports no model drift with `alembic check`.
- Backend persistence paths use SQLAlchemy models/typed statements; tests cover schema constraints, idempotency replay, and initialization on an empty database.
- Redis wiring was removed because no API runtime code used it; interview orchestration remains in-process.
- The demo seed command refuses to run outside demo mode.

### Partial

- Interview setup, session APIs, report/evaluation endpoints, resume/JD handling, coaching, and Agora integration code exist, but an end-to-end interview against real external services was not exercised.
- Dashboard, coaching, reports, and performance history include deterministic or generated sample values in the mock service. They are now visibly marked as demo/sample data; they are not real user measurements.
- SQLite migration setup and teardown are verified locally. PostgreSQL migration remains unverified: Docker Compose cannot reach the Docker Desktop Linux engine (`/_ping` returns HTTP 500). A Windows PostgreSQL service is running locally, but it was not treated as the isolated Compose/pgvector test database.
- Existing databases from the old handwritten schema are not adopted automatically; they need a backup and a separate data-preserving migration plan.
- Clerk auth, Agora voice, and OpenAI analysis code are present, but real-credential paths were not exercised.

### Broken

- Backend `pnpm type-check` is not clean. The configured mypy run reports an untyped `agora_token_builder` import and a NumPy stub syntax issue under its configured Python 3.11 target. An additional run with `mypy --python-version 3.12 app/` reports 41 errors across 12 files.
- Root `pnpm lint` is not clean: Pylint exits 28 with a 7.22/10 score. Frontend lint itself passes with two existing `<img>` optimization warnings.
- `/api/users/register` is still a placeholder endpoint and does not persist a registration.

### Missing

- No full browser-to-API interview/evaluation smoke test is in place.
- No CI result has yet been observed on GitHub; the workflow has been added locally.

### Blocked by credentials or environment

- Current local API reports OpenAI, Agora, Clerk, and PostgreSQL features as unavailable. Their live integrations cannot be verified without configured credentials/services.
- Python 3.11 is not installed in this Windows environment (`py -0p` lists Python 3.12 and 3.14). CI now tests Python 3.11 and 3.12; only Python 3.12 was verified locally.

## Baseline command results

Successful commands:

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` (repository root) | Exit 0; all five workspace projects resolved and installed. |
| `pnpm --filter @voicehire/web type-check` | Exit 0 (`tsc --noEmit`). |
| `pnpm --filter @voicehire/web lint` | Exit 0; two `<img>` optimization warnings in Settings and Sidebar. |
| `pnpm --filter @voicehire/web build` | Exit 0; Next.js 14.2.35 compiled and generated all 14 application routes. |
| `pnpm build` (repository root) | Exit 0; workspace build completed, including the web production build. |
| `python -m pip install -e ".[dev]"` (from `apps/api`, clean Python 3.12 venv) | Exit 0; installed the editable API, `aiosqlite==0.19.0`, and declared dev dependencies. |
| `python -m pytest tests/ -v` (from `apps/api`, clean Python 3.12 venv) | Exit 0; 12 passed, 13 Pydantic deprecation warnings. |
| `pnpm test` (repository root, API venv on `PATH`) | Exit 0; 12 passed, 13 Pydantic deprecation warnings. |
| `python -m pytest tests/ -v` (from `apps/api`, project venv) | Exit 0; 12 passed, 13 Pydantic deprecation warnings. |
| `python -m pytest tests/ -v` (from `apps/api`, after schema work) | Exit 0; 16 passed, 19 warnings. |
| `python -m alembic upgrade head` (fresh SQLite database) | Exit 0; initial revision `e7f663ed59d9` applied. |
| `python -m alembic check` (migrated SQLite database) | Exit 0; `No new upgrade operations detected.` |
| `python -m alembic downgrade base` (fresh SQLite database) | Exit 0; initial revision downgraded cleanly. |
| `git diff --check` | Exit 0. |
| `git check-ignore -v apps/web/lib apps/web/lib/utils.ts` | Exit 1 as expected: neither path is ignored after the root-anchored ignore-rule fix. |
| Secret-pattern scan of `apps/web/lib` | Scanned six files; no matching hardcoded secret patterns found. |
| `redis.asyncio` import (Python 3.12) | Passed. |

Runtime checks, with `pnpm dev` running both workspace apps:

| Request | Result |
|---|---|
| `GET http://127.0.0.1:8000/api/health/ready` | HTTP 200, `{"status":"ready","service":"voicehire-api"}` |
| `GET http://127.0.0.1:8000/api/health/live` | HTTP 200, `{"status":"alive","service":"voicehire-api"}` |
| `GET http://127.0.0.1:8000/` | HTTP 200; status `running`, mode `demo`, feature flags report OpenAI/Agora/Clerk/PostgreSQL unavailable. |
| `GET http://127.0.0.1:3000/` | HTTP 200; rendered content contains the demo/sample-data label. |

Known failures and caveats:

- `pnpm type-check` at the repository root (API venv on `PATH`) invokes both `tsc` and mypy and exits 2: the configured Python 3.11 target cannot analyze the installed `agora_token_builder` package because it has no stubs, and mypy 1.7.0 cannot parse a NumPy 2.5.2 stub syntax feature. The web type-check passes.
- `pnpm lint` at the repository root exits 28: Pylint reports 7.22/10 (472 diagnostics in the current run). Frontend lint passes with two existing `<img>` optimization warnings.
- The installed `aioredis==2.0.1` was tested on Python 3.12 and failed to import with `ModuleNotFoundError: No module named 'distutils'`. It was removed from the manifest; the already-declared `redis` package's `redis.asyncio` import succeeds.
- A clean Python 3.12 environment was install-tested. Python 3.11 could not be tested locally because that interpreter is unavailable.
- Full live-service flows remain blocked by the credentials/services noted above.
- `docker compose up -d postgres` and `docker compose ps` could not communicate with Docker Desktop (`/_ping` or the container-list API returned HTTP 500), so the PostgreSQL/pgvector migration gate has not passed. Do not treat the locally running Windows PostgreSQL service as a substitute for the Compose database without confirming its ownership and configuration.

## Remaining

- Resolve backend mypy and Pylint findings without disabling checks.
- Run the added pull-request workflow on GitHub and address any environment-specific failures.
- Add real-service end-to-end coverage when credentials and services are available.
- Retry `docker compose up -d postgres` and `alembic upgrade head` against the Compose PostgreSQL/pgvector service when Docker Desktop is healthy.
- Plan an explicit, data-preserving adoption migration before upgrading any pre-existing database created by the removed handwritten schema.
