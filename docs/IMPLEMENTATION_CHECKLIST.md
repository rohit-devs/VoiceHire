# Implementation Checklist and Baseline

Baseline recorded on 2026-10-14 on branch `feat/finish-voicehire`.

## Current interview-flow task

### Implemented and verified

- Interview lifecycle endpoints use the persisted `created`, `ready`, `connecting`, `interviewing`, `processing_response`, `completed`, `failed`, and `cancelled` state machine. Start/end repetition, invalid transcript timing, transition history, timestamps, and question-budget completion are covered by API tests.
- Session setup accepts candidate resume text plus a job description or category, and persists a blueprint before starting. Difficulty, duration, interview type, job context, experience level, persona, and explicit demo flag are stored and returned by the API; the web client maps the returned values on reload rather than substituting defaults.
- Text answers are persisted before the API requests the next question. The provider receives the static, versioned interviewer rules as system content and blueprint/conversation data as user content. FakeProvider tests cover answer-grounded follow-ups, short/uncertain answers, injection attempts, and bounded question budgets.
- Simulated interviews require explicit `is_demo`, use FakeProvider only when demo mode is enabled, return `is_demo` and `source`, mark every transcript `source="simulated"`, show a “Simulated demo” UI badge, and cannot produce evaluations or enter real report listings.
- Fabricated demo transcripts/metrics were removed. Evaluation reports return explicit `insufficient data`; transcript/timing analytics expose only defined evidence-based metrics, with null values and reasons when evidence is missing, and identify simulated data.
- Frontend interview setup/live/prepare/complete screens use the API service, require pasted resume text, accept job-description text or a category, and no longer use canned questions, simulated candidate answers, guessed question totals, or hardcoded fit scores.
- Backend regression suite passes: 38 tests, including end-to-end text interview lifecycle, report schema/fairness validation, persisted report idempotency, demo isolation, coaching progress, and SQLite migration checks.

### Partial

- The API-backed full text flow is exercised in-process with FakeProvider, not in a real browser against a running backend.
- OpenAIProvider retries, timeout handling, and token usage logging are implemented, but a real OpenAI request was not exercised. No candidate or résumé text is logged by the interviewer provider.
- Evaluation reports now separate measured transcript/timing metrics from schema-validated AI judgments. Reports are persisted and reloaded; live OpenAI-backed generation remains unverified locally.
- Agora voice and live-provider flows are not verified; text answers are the working, tested path.

### Blocked by credentials or environment

- Live OpenAI behavior requires a valid `OPENAI_API_KEY`; no live-provider result is claimed.
- PostgreSQL/pgvector verification remains blocked by the Docker Desktop failure recorded below.

### Current command results

| Command | Result |
|---|---|
| `python -m pip install -e ".[dev]"` (from `apps/api`, Python 3.12) | Exit 0 with `openai==1.109.1`; editable API and dev dependencies installed. |
| `python -m pytest tests\\ -v` (from `apps/api`) | Exit 0; 22 passed, 20 Pydantic deprecation warnings. |
| `pnpm --filter @voicehire/web type-check` | Exit 0 (`tsc --noEmit`). |
| `pnpm --filter @voicehire/web lint` | Exit 0; two existing `<img>` optimization warnings in Settings and Sidebar. |
| `pnpm --filter @voicehire/web build` | Exit 0; Next.js production build generated all 14 application routes. |
| `git diff --check` | Exit 0; Git printed only line-ending conversion notices for modified files. |

## Transparent LLM evaluation

### Implemented

- Added the versioned [evaluator.yaml](../packages/prompts/evaluator.yaml) rubric (`1.0.0`) with seven categories, per-category anchored 0–5 scales, default weights, evaluator safety instructions, and a `EVALUATION_RUBRIC_WEIGHTS` JSON override. Overrides must specify every category and are normalized.
- Replaced report placeholders with a Pydantic-validated evaluator. Each question/answer pair is submitted with target-role and relevant resume/job context; evidence quotes must exactly occur in the answer. Category keys, scores, weighted overall score, question coverage, exercise categories, target role, and prohibited inferences are validated. Invalid output is retried once; a second invalid result persists a failed report with no AI assessment.
- Reports separately persist computed speaking duration, WPM, filler rate, average and per-answer lengths, questions answered, and time remaining, plus AI judgments and rubric version. Missing evidence is represented by null values and reasons. Existing legacy reports are marked `insufficient_data` and their old score fields are not exposed through the new API.
- Report generation is unique per session; repeat requests return the stored report and do not call the model again. Per-user/session token budgets are reserved and reconciled. Demo sessions cannot create or retrieve real evaluations.
- Added a report UI that labels computed metrics separately from AI judgments, displays exact evidence quotes and a visible guidance disclaimer, and lets candidates mark practice exercises complete. Coaching items come from the three weakest rubric categories and match the target role; progress is persisted with ownership checks.
- Removed the dashboard's fixed `+19%` trend indicator. The legacy performance-history chart remains empty until it has a lossless mapping from the new report schema.

### Verification results

| Command | Result |
|---|---|
| `python -m pytest tests\\ -v` (from `apps/api`, Python 3.12) | Exit 0; 38 passed, 34 Pydantic deprecation warnings. Includes evaluator schema/fairness retries, missing-data nulls, measured-metric fixture, persisted report reload/idempotency, ownership, demo isolation, coaching progress, and SQLite migration up/down. |
| `pnpm --filter @voicehire/web type-check` | Exit 0 (`tsc --noEmit`). |
| `pnpm --filter @voicehire/web lint` | Exit 0; two existing `<img>` optimization warnings in Settings and Sidebar. |
| `pnpm --filter @voicehire/web test` | Exit 0; 2 mocked Agora hook tests passed. |
| `pnpm --filter @voicehire/web build` | Exit 0; Next.js production build generated all 14 application routes, with the same two image warnings. |
| `git diff --check` | Exit 0; Git printed only line-ending conversion notices. |

### Partial and blocked

- Report generation, invalid-output handling, exact evidence validation, token accounting, reload persistence, and coaching progress are tested through the API with a deterministic test provider. No live LLM call or browser-based report walkthrough was performed.
- Live evaluation requires a configured OpenAI key and remains unverified; actual provider response quality, scoring consistency, and billed usage were not independently confirmed.
- PostgreSQL migration verification remains blocked by the Docker Desktop limitation documented in the baseline section. SQLite migration up/down is verified.

## Voice implementation and verification

### Implemented

- Read Agora's official RTC/Web SDK and Conversational AI documentation before implementation. Chose Agora RTC 4.x with browser Web Speech recognition/synthesis and the existing interview API; this is explicitly not an Agora Conversational AI agent. See [VOICE_ARCHITECTURE.md](./VOICE_ARCHITECTURE.md).
- Replaced the old token paths with one server-side token module. Tokens derive the channel and UID from the owned session, are limited to interviewable states and at most one hour, and never return the App Certificate. The production `demo-` token path is removed.
- Unified the Agora hooks with lifecycle/permission/connection states, mute controls, network quality, actual Agora audio levels, bounded reconnects, and transport cleanup. Browser STT/TTS are behind provider interfaces; missing Agora/browser support leaves text entry available and states the limitation.
- Authenticated WebSocket connections to session ownership, replayed persisted events after `after_sequence`, and added stable message IDs, sequence numbers, server timestamps, speaker/source metadata, and duplicate-message persistence/broadcast coverage.
- Added measured speaking duration, timed-segment WPM, language-specific filler rate, average answer length, and time remaining. Insufficient evidence yields null plus a reason. Demo metrics/events carry `source="simulated"`.
- Removed confidence/fingerprint/legacy score fields from the report UI and report API. Reports now state that verified analysis is unavailable; the app does not infer candidate confidence, emotion, pronunciation, or vocal tone from transcript text.

### Verification results

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` (repository root) | Exit 0; all four workspace projects already up to date. |
| `pnpm install --frozen-lockfile` (from `apps/web`) | Exit 0; nested web lockfile up to date and esbuild postinstall completed. |
| `python -m pytest tests\\ -v` (from `apps/api`, Python 3.12) | Exit 0; 30 passed, 34 Pydantic deprecation warnings. Includes SQLite migration up/down, voice metrics, token authorization/expiry, duplicate transcript handling, WebSocket replay/isolation, and demo interview flow. |
| `pnpm --filter @voicehire/web type-check` | Exit 0 (`tsc --noEmit`). |
| `pnpm --filter @voicehire/web lint` | Exit 0; two existing `<img>` optimization warnings in Settings and Sidebar. |
| `pnpm --filter @voicehire/web test` | Exit 0; 2 mocked Agora hook tests passed (join/mute/cleanup and microphone permission denial). |
| `pnpm --filter @voicehire/web build` | Exit 0; Next.js 14.2.35 generated all 14 application routes, with the same two image warnings. |

### Revalidation on 2026-10-15

- `pnpm install --frozen-lockfile` from the repository root and from `apps/web`: both exited 0; both lockfiles were already up to date.
- `python -m pytest tests\\ -v` from `apps/api`: exit 0; 30 passed, 34 Pydantic deprecation warnings.
- `pnpm --filter @voicehire/web type-check`: exit 0 (`tsc --noEmit`).
- `pnpm --filter @voicehire/web lint`: exit 0; same two `<img>` optimization warnings in Settings and Sidebar.
- `pnpm --filter @voicehire/web test`: exit 0; 2 mocked Agora hook tests passed.
- `pnpm --filter @voicehire/web build`: exit 0; production build compiled and generated all application routes, with the same two image warnings.
- `git diff --check`: exit 0; only Git line-ending conversion notices were printed.

### Partial and blocked

- The FakeProvider demo lifecycle is covered end-to-end through the API, and the room retains text input when Agora is unavailable. The browser room has not been manually exercised end-to-end.
- Agora credentials, a supported physical/browser microphone, browser-specific SpeechRecognition behavior, and live OpenAI credentials were unavailable for this task. Therefore no live Agora connection or manual two-minute voice interview is claimed.
- The Agora token, WebSocket replay/ownership, transcript idempotency, metrics, and mocked RTC lifecycle are covered by tests; live service connectivity, multi-device reconnect behavior, and browser STT privacy/quality remain unverified.
- PostgreSQL/pgvector migration verification remains blocked by the Docker Desktop limitation documented in the baseline section.

## Feature inventory

### Implemented and verified

- Next.js App Router pages type-check, lint, build, and serve the home page.
- FastAPI starts against local SQLite. `/api/health/ready`, `/api/health/live`, and `/` return HTTP 200.
- API root and `/healthz` report the configured demo/live mode. Tests cover both values.
- API tests cover demo auth behavior, session ownership, and failed user persistence.
- Demo-mode banner identifies when demo features are enabled; each simulated interview is separately opted into and labeled.
- The pnpm workspace discovers the web, API script package, database, and prompts workspaces.
- Frontend `apps/web/lib` files are tracked; a targeted scan of all six files found no matching hardcoded secret patterns.
- SQLAlchemy models and Alembic migrations are the backend schema authority; the web app does not import Prisma Client, so the unused Prisma package and duplicate handwritten SQL schema were removed.
- The initial Alembic migration creates the schema on fresh SQLite, downgrades cleanly, and reports no model drift with `alembic check`.
- Backend persistence paths use SQLAlchemy models/typed statements; tests cover schema constraints, idempotency replay, and initialization on an empty database.
- Redis wiring was removed because no API runtime code used it; interview orchestration remains in-process.
- The demo seed command refuses to run outside demo mode.

### Partial

- The real OpenAI-backed interview flow and Agora integration are not exercised against external services. Interview session construction and FakeProvider question-generation are covered by local API tests.
- Dashboard and performance history show no fabricated trend values. New reports display measured metrics and schema-validated AI judgments separately; legacy fingerprint data remains unavailable.
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

- Live OpenAI, Agora, Clerk, and PostgreSQL integrations cannot be verified without configured credentials/services.
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
- Attempting `openai==3.31.0` with the repository's pinned FastAPI 0.104.1 failed dependency resolution because that OpenAI major requires AnyIO 4 while FastAPI 0.104.1 requires AnyIO below 4. The pin is `openai==1.109.1`, the newest compatible 1.x release; its `AsyncOpenAI` client and `max_completion_tokens` API were verified locally.
- `docker compose up -d postgres` and `docker compose ps` could not communicate with Docker Desktop (`/_ping` or the container-list API returned HTTP 500), so the PostgreSQL/pgvector migration gate has not passed. Do not treat the locally running Windows PostgreSQL service as a substitute for the Compose database without confirming its ownership and configuration.

## Remaining

- Resolve backend mypy and Pylint findings without disabling checks.
- Run the added pull-request workflow on GitHub and address any environment-specific failures.
- Add real-service end-to-end coverage when credentials and services are available.
- Implement measured response analysis and report generation before exposing evaluation scores or communication metrics.
- Retry `docker compose up -d postgres` and `alembic upgrade head` against the Compose PostgreSQL/pgvector service when Docker Desktop is healthy.
- Plan an explicit, data-preserving adoption migration before upgrading any pre-existing database created by the removed handwritten schema.
