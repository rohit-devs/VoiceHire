# Troubleshooting

## Docker Compose does not start

- Run `docker compose version` and `docker info`; Compose CLI availability does not prove the Docker Engine is running.
- If the Linux engine returns a named-pipe or daemon error, start Docker Desktop/Engine and retry `docker compose up --build`.
- `docker compose config --quiet` validates Compose syntax without starting containers.
- PostgreSQL health is gated with `pg_isready`. If the database was initialized with a different password, update `POSTGRES_PASSWORD` consistently or use an explicitly planned local volume reset. `docker compose down -v` permanently deletes the local database volume.

## API is unhealthy or migrations fail

- Request `http://127.0.0.1:8000/api/health/ready`. Database connection failure returns HTTP 503 without exposing the connection string.
- Confirm `DATABASE_URL` points to a reachable SQLite or PostgreSQL database. For Compose, use hostname `postgres`, not `localhost`.
- Ensure the PostgreSQL server has pgvector installed; the migration enables the `vector` extension.
- Run `alembic upgrade head` from `apps/api` (or `pnpm --filter @voicehire/api db:migrate` at the repository root). Back up existing data before schema upgrades.
- The API applies migrations during startup; inspect API container logs for a revision or database error.

## Clerk sign-in fails

- Production web needs a valid `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` at build time and `CLERK_SECRET_KEY` at runtime.
- API JWT verification needs `CLERK_SECRET_KEY` and the matching `CLERK_JWT_JWKS_URL`.
- Verify Clerk allowed domains, callback/redirect URLs, and configured issuer match the web deployment.
- The shared local demo user is available only when both `APP_ENV=development` and `DEMO_MODE=true`, with Clerk keys absent. It is not an authentication substitute for deployment or a safe multi-user environment.

## OpenAI evaluation unavailable

- With an empty `OPENAI_API_KEY`, a real completed session's report is persisted with `status=failed` and an explicit error; no score is fabricated.
- Verify API server secret configuration and `OPENAI_MODEL`. Do not put the key in the Vercel web environment or any `NEXT_PUBLIC_*` variable.
- Simulated demo sessions are intentionally not eligible for real evaluations.

## Agora unavailable

- Verify `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` on the API only. The certificate is never returned to the browser.
- Without usable credentials, token generation responds with HTTP 503 and the client should use text input. A configured token does not prove that a live Agora channel can be reached.
- Browser microphone permission, supported devices, network connectivity, and speech recognition availability must be checked on the target browser/device.

## Playwright cannot start or fails

- Install the browser with `pnpm --filter @voicehire/web exec playwright install chromium`.
- `pnpm --filter @voicehire/web test:e2e` starts a separate API on port 8100 and web app on port 3101, sets development demo mode, and uses an isolated temporary SQLite database. It does not need Clerk/OpenAI/Agora keys.
- The E2E app uses the shared local demo user. The demo UI intentionally refuses real evaluations and coaching plans; real report/coaching lifecycle coverage is provided by backend tests using a deterministic provider.
- Check whether another process or a security policy blocks ports 8100/3101. The test runner will not reuse existing servers.

## Readiness provider status

The readiness response always probes the database. Optional `openai`, `agora`, and `clerk` statuses report configuration completeness (`ok`, `degraded`, or `disabled`), not live upstream availability. `redis` remains `disabled` because the API does not currently consume it.

## Ollama follow-up question generation returns HTTP 500

**Symptom:** Interview start returns Q1 ("Tell me about yourself.") successfully, but `POST /api/interviews/sessions/{id}/generate-question` returns HTTP 500 with `"Failed to generate question"`. Health shows `llm: ok` using `ollama`.

**Root cause:** `FallbackProvider.complete()` in `apps/api/app/interview/provider_fallback.py` expected keyword-only args `(session_id, system_prompt, user_content, max_tokens)`, but `LegacyProviderAdapter.complete()` calls it positionally with `([ChatMessage...], purpose=..., max_tokens=...)`. The wrapped providers in `apps/api/providers/llm.py` (GroqProvider, OllamaProvider) also expect `([ChatMessage...], purpose=..., max_tokens=...) -> str`, not the `LLMProvider` protocol signature. The resulting `TypeError` was not caught by the coordinator's bounded-retry handler, so it propagated as HTTP 500.

**Fix:** `FallbackProvider.complete()` now accepts `messages: Sequence[ChatMessage], *, purpose, max_tokens -> str`, matching both the caller (`LegacyProviderAdapter`) and the wrapped providers. Added `model_for()` delegation so `LegacyProviderAdapter` can read the model name. Added regression test `apps/api/tests/test_followup_question_generation.py`.

**Smoke test results (Ollama `llama3.2:1b`, `DEMO_MODE=false`):**
- Q1 opener: `"Tell me about yourself."` (fixed opener, not from LLM)
- Q2-Q4 (strong/vague/off-topic answers): valid follow-up questions, `source=real`, `degraded=false`, latency 5-11s
- Q5 (1-word answer): Ollama echoed the raw prompt JSON as question text — 1B model quality issue, handled gracefully, not a crash
- Q6 (long answer): question budget reached, closing question returned
- All follow-ups: `source=real`, `degraded=false` — no bank fallback needed

## Evaluation report fails schema validation with Ollama

**Symptom:** `POST /api/evaluations/sessions/{id}/report/generate` returns `status=failed`, `error="Provider output did not match the evaluation schema"`, `ai_assessments=null`.

**Cause:** The `llama3.2:1b` model cannot produce output matching the evaluation JSON schema. Report generation takes ~44s. This is a model-quality limitation, not a code bug.

**Report regeneration blocked:** `apps/api/app/routers/evaluations.py:404-408` returns the existing report early if one exists, regardless of status. A `failed` report blocks regeneration — the endpoint returns the failed report instead of retrying. To regenerate, the existing `EvaluationReport` row must be deleted first.

**Voice/STT:** UNVERIFIED — Deepgram and Groq are `disabled` (no API keys). Browser Web Speech API STT is the fallback but was not tested.

