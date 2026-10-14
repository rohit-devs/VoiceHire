# VoiceHire Deployment

## Local demo

1. Copy `.env.example` to `.env` and provide Agora credentials for real voice. Leave them empty to use the WebSocket demo.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Install API dependencies with `pip install -e apps/api`.
4. From `apps/api`, apply the schema with `alembic upgrade head`.
5. Start the API with `python -m uvicorn app.main:app --reload --port 8000`.
6. Start the web app with `pnpm --dir apps/web dev`.
7. Open `/interview/demo-session-1` for simulated transcript/metrics streaming.

SQLAlchemy models and Alembic migrations own the backend schema; see [docs/database-setup.md](docs/database-setup.md). The API does not use Redis. Configure `DATABASE_URL`, Clerk settings, Agora settings, and `OPENAI_API_KEY` through the deployment secret store. Never place Agora certificates, Clerk secret keys, or OpenAI keys in the web environment.

## Validation

- `python -m compileall -q apps/api/app`
- `apps/web/node_modules/.bin/tsc.cmd --noEmit -p apps/web/tsconfig.json`
- `docker compose config`
- Start a `demo-*` session and verify transcript, state, metrics, and report generation.
