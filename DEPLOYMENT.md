# VoiceHire Deployment

## Local demo

1. Copy `.env.example` to `.env` and provide Agora credentials for real voice. Leave them empty to use the WebSocket demo.
2. Start infrastructure with `docker compose up -d postgres redis`.
3. Install API dependencies with `pip install -e apps/api`.
4. Start the API with `python -m uvicorn app.main:app --reload --port 8000`.
5. Start the web app with `pnpm --dir apps/web dev`.
6. Open `/interview/demo-session-1` for simulated transcript/metrics streaming.

The API container is provided for deployment. Configure `DATABASE_URL`, `REDIS_URL`, Clerk settings, Agora settings, and `OPENAI_API_KEY` through the deployment secret store. Never place Agora certificates, Clerk secret keys, or OpenAI keys in the web environment.

## Validation

- `python -m compileall -q apps/api/app`
- `apps/web/node_modules/.bin/tsc.cmd --noEmit -p apps/web/tsconfig.json`
- `docker compose config`
- Start a `demo-*` session and verify transcript, state, metrics, and report generation.
