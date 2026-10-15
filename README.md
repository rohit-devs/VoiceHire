# VoiceHire

VoiceHire is a Next.js 14 and FastAPI application for practicing job interviews. The API persists interview sessions, transcripts, evidence-based reports, and coaching progress. SQLAlchemy models and Alembic migrations are the backend schema authority.

## Current capabilities

- Clerk authentication for configured deployments, with a clearly labeled shared local demo user when `APP_ENV=development` and `DEMO_MODE=true`.
- Interview setup from candidate resume text and a job description or role category.
- Text interview flow, plus optional Agora RTC and browser speech features when configured and supported.
- Deterministic interviewer behavior for explicitly selected simulated demo sessions.
- Persisted reports and coaching plans for completed real sessions when OpenAI is configured. Simulated sessions do not generate real evaluations.
- SQLite for local development and PostgreSQL with pgvector for Compose/deployment.

Real Agora connectivity, real OpenAI evaluation, and production deployment require provider configuration. Demo outputs are marked as simulated and must not be treated as evidence of candidate competence. No production deployment is claimed by this repository documentation.

## Run locally

For a complete Docker stack, copy `.env.example` to `.env` and run:

```sh
docker compose up --build
```

Open the web app at <http://localhost:3000>. The API is at <http://localhost:8000>; readiness and liveness are available at `/api/health/ready` and `/api/health/live`. Compose runs Alembic migrations before starting the API, and binds published ports to loopback only. The example `.env` opts into the shared local demo user; without that explicit config demo mode defaults off. Never use the shared demo user with real candidate data.

For native development, installation, environment setup, migrations, and Windows-specific commands, see [SETUP_GUIDE.md](./SETUP_GUIDE.md).

## Verification

```sh
pnpm install --frozen-lockfile
pnpm --filter @voicehire/web type-check
pnpm --filter @voicehire/web lint
pnpm --filter @voicehire/web test
pnpm --filter @voicehire/web test:e2e
pnpm --filter @voicehire/web build
```

Backend tests (from `apps/api`):

```sh
python -m pip install -e ".[dev]"
python -m pytest tests/ -v
```

The end-to-end browser suite starts an isolated local SQLite API and Next.js server with an explicit demo user. Cross-user access, provider outages, missing keys, database migrations, and evaluation behavior are also covered by backend tests. Consult [docs/IMPLEMENTATION_CHECKLIST.md](./docs/IMPLEMENTATION_CHECKLIST.md) for current verification results and known limitations.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [docs/DEPLOYMENT_CHECKLIST.md](./docs/DEPLOYMENT_CHECKLIST.md) for Vercel web deployment, Railway/Render API deployment, migration, Clerk, CORS, and secret configuration. Keep server-only credentials in server secret stores; never expose OpenAI keys, Agora certificates, or Clerk secret keys through `NEXT_PUBLIC_*` variables.

## Architecture and operations

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) — Windows PowerShell and Linux/macOS setup.
- [DEPLOYMENT.md](./DEPLOYMENT.md) — deployment steps and environment configuration.
- [docs/DEPLOYMENT_CHECKLIST.md](./docs/DEPLOYMENT_CHECKLIST.md) — release verification checklist.
- [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) — common local and provider issues.
- [docs/database-setup.md](./docs/database-setup.md) — schema ownership and migration workflow.
- [docs/VOICE_ARCHITECTURE.md](./docs/VOICE_ARCHITECTURE.md) — voice architecture and explicit capability limits.
- [docs/IMPLEMENTATION_CHECKLIST.md](./docs/IMPLEMENTATION_CHECKLIST.md) — feature inventory, verified baseline, and remaining work.
