# Development commands

Follow [SETUP_GUIDE.md](./SETUP_GUIDE.md) for supported Windows PowerShell and Linux/macOS setup. The authoritative schema workflow is Alembic; the API applies migrations on startup, and developers may apply them explicitly with `pnpm --filter @voicehire/api db:migrate`.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm --filter @voicehire/web type-check
pnpm --filter @voicehire/web lint
pnpm --filter @voicehire/web test
pnpm --filter @voicehire/web test:e2e
```

Install the backend into a Python 3.11 or 3.12 virtual environment with `python -m pip install -e "apps/api[dev]"`, then run `python -m pytest apps/api/tests/ -v`.

For an isolated end-to-end environment, Playwright creates a temporary SQLite database and starts web/API servers on ports 3101/8100 in explicit local demo mode. The browser journey uses only simulated interview content. Report schema, real-session evaluation using a deterministic provider, coaching persistence, and cross-user ownership are tested by backend tests.

Docker Compose provides PostgreSQL with pgvector, Redis (currently unused by the API), API, and web services. See [DEPLOYMENT.md](./DEPLOYMENT.md) for platform configuration and [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for diagnostics.
