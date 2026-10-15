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
- Dashboard, interviews, reports, coaching, progress, and settings now load through the typed API service with loading, empty, and retryable error states; mock dashboard/interview services and the unused user store were removed.
- Clerk middleware protects application routes; sign-in, sign-up, and onboarding pages are present. Onboarding persists target role and background through the authenticated profile API, and API requests obtain a fresh Clerk token.
- Interview setup supports resume text/upload and job description or category input, while the live room displays persisted transcript entries and labels simulated sessions.
- Service error handling has Vitest coverage. Playwright smoke tests cover the landing page, unauthenticated redirect, setup validation, and a simulated interview; browser execution is blocked locally by missing Clerk credentials (see latest revalidation).
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

### Missing

- A successful browser-to-API interview/evaluation smoke run has not yet been observed; Playwright scenarios exist but require Clerk credentials and authenticated browser storage state.
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

- Clerk-hosted sign-in/sign-up integration remains unverified locally because no Clerk credentials are configured. The local demo sign-in and simulated interview browser path is verified separately below.
- Resolve backend mypy and Pylint findings without disabling checks.
- Run the added pull-request workflow on GitHub and address any environment-specific failures.
- Add real-service end-to-end coverage when credentials and services are available.
- Retry `docker compose up -d postgres` and `alembic upgrade head` against the Compose PostgreSQL/pgvector service when Docker Desktop is healthy.
- Plan an explicit, data-preserving adoption migration before upgrading any pre-existing database created by the removed handwritten schema.

## Real-data UI and auth delivery revalidation

### Implemented

- Removed the hardcoded/mock dashboard and interview-service paths. Dashboard, session history, reports, coaching progress, and profile/settings now read or update backend data through the API service. Empty states do not invent scores, and demo records remain identified as simulated.
- Added Clerk-protected application routes, sign-in/sign-up routes, and an onboarding form that persists profile details and target role. API token retrieval is refreshed per request.
- Added service-layer tests and Playwright tests for public landing, unauthenticated redirect, setup validation, and simulated interview flow.
- Added persisted transcript retrieval and included candidate answers alongside report evidence on report detail.

### Verification results

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Exit 0; lockfiles already up to date. |
| `pnpm --filter @voicehire/web type-check` | Exit 0 (`tsc --noEmit`). |
| `pnpm --filter @voicehire/web lint` | Exit 0; no errors or warnings. |
| `pnpm --filter @voicehire/web test` | Exit 0; 4 tests passed. |
| `pnpm --filter @voicehire/web build` | Exit 0; production build passed with dependency Edge Runtime warnings from Next/Clerk dependencies. |
| `python -m pytest tests/ -q` (from `apps/api`) | Exit 0; 39 passed, 34 Pydantic deprecation warnings. |
| `alembic upgrade head` then `alembic downgrade base` (fresh SQLite DB) | Both exited 0, including the user-preferences migration. |
| `pnpm exec playwright test --grep-invert "authenticated interview flows"` (from `apps/web`) | Exit 1 before smoke tests completed. Next.js middleware repeatedly reported `Missing Clerk Secret Key or API Key`; no Clerk credentials are configured locally. |
| `git diff --check` | Exit 0; only Git line-ending conversion notices. |

### Blocked and remaining

- No Clerk secret/publishable keys are available. Clerk-hosted sign-in/sign-up remains unverified; the local demo sign-in and end-to-end simulated interview are verified below.
- The previously running Next.js process on port 3000 was left untouched. Playwright uses port 3001 to avoid taking over that process.
- Clerk-hosted sign-in/sign-up remains unverified without test credentials. The local-demo setup and simulated interview path is verified in the end-to-end baseline below. No live Clerk, Agora, or OpenAI integration is claimed.

## Whole-system E2E and deployment baseline

### Feature inventory

| Area | Status | Evidence / limitation |
|---|---|---|
| API persistence, migrations, session ownership, report/coaching ownership | Implemented and verified | Backend tests cover SQLite migrations, session lifecycle, report persistence and idempotency, coaching progress, simulated-session isolation, unavailable providers, and cross-user access denial. |
| Landing, local demo login, onboarding/profile persistence, interview setup | Implemented and browser-verified | Playwright completes the local demo profile save and validates its persisted target role; setup requires real resume and job context. |
| Simulated text interview | Implemented and browser-verified | Playwright creates and starts an explicitly opted-in demo, submits a candidate answer, checks the persisted transcript, reloads the room, ends the interview, and verifies that no real evaluation is generated. |
| Real OpenAI report and coaching flow | Implemented and backend-tested with FakeProvider; live provider unverified | Demo sessions intentionally cannot create a real evaluation or real coaching plan. Backend tests exercise the real-session FakeProvider route and persistence. No OpenAI key was used. |
| User A/User B isolation | Implemented and backend-tested | Cross-user session/report/coaching access is rejected by API tests; browser E2E does not provision two separate Clerk accounts. |
| Agora voice | Partial / unverified | SDK import is deferred to the browser so Next.js server rendering succeeds. No Agora credentials or live two-minute voice interview were available; text input remains usable. |
| Clerk-hosted sign-in/sign-up | Partial / blocked by credentials | Local demo sign-in is verified. No Clerk test keys were configured, so hosted Clerk authentication was not exercised. |
| Readiness and liveness | Implemented and verified locally | Fresh SQLite API instance returned HTTP 200 for `/api/health/ready`, `/api/health/live`, and `/`; provider states were `disabled` and database was `ok`. No secret values were returned. |
| Docker/PostgreSQL/pgvector stack | Configuration verified; runtime blocked by Docker Engine | `docker compose config --quiet` passes. Docker Desktop returned HTTP 500 from its Linux engine pipe, so image builds, Compose startup, PostgreSQL migration, and container health checks were not verified. |
| Redis | Explicitly unused | Compose includes Redis for infrastructure testing; readiness reports it disabled because application runtime does not use it. |
| Deployment / GitHub CI | Not verified | No production URL was deployed. The workflow file exists, but no GitHub Actions run was executed in this session. |

### Latest command results

| Command / check | Result |
|---|---|
| `pnpm --filter @voicehire/web exec playwright test --workers=1` | Exit 0; 3 passed (landing; local demo onboarding persistence; simulated interview create/start/answer/transcript/reload/end and evaluation isolation). Earlier attempts exposed test-step/response-shape issues and an SSR import error; those were corrected before this passing run. |
| `pnpm --filter @voicehire/web type-check` | Exit 0 (`tsc --noEmit`) after making Agora SDK runtime import browser-only. |
| `pnpm --filter @voicehire/web lint` | Exit 0; no warnings or errors. |
| `pnpm --filter @voicehire/web test` | Exit 0; 4 tests passed. |
| `pnpm --filter @voicehire/web build` | Exit 0; Next.js 14.2.35 built all application routes. |
| `apps\\api\\.venv\\Scripts\\python.exe -m pytest apps\\api\\tests -q` | Exit 0; 43 passed, 39 deprecation warnings. |
| `docker compose config --quiet` | Exit 0 after local-only port bindings and demo-off Compose defaults. |
| `docker info --format '{{.ServerVersion}}'` | Docker Engine unavailable: API call to `//./pipe/dockerDesktopLinuxEngine` returned HTTP 500. |
| `pnpm audit --prod` | Exit 1; 30 findings: 2 critical, 12 high, 13 moderate, 3 low. Both critical findings affect Next.js 14 and require Next.js `>=15.5.24` per the audit advisories; no framework-major upgrade was attempted. |
| `python -m pip_audit --path apps\\api\\.venv\\Lib\\site-packages` | Exit 1; 60 known advisory records across 12 packages (including FastAPI/Starlette, python-multipart, python-jose, requests, and dev tools). The editable local `voicehire-api` package is skipped because it is not a PyPI distribution. |
| Local credential-pattern scan (138 non-ignored working files) | No credential-shaped matches after replacing the test-only placeholder. |
| Git-history credential-pattern scan (3,811,894 patch bytes) | Four OpenAI-shaped matches were confined to prior test-fixture placeholders in `apps/api/tests/conftest.py`; no production credential pattern was found. This scan does not rewrite history. |
| Built browser bundle scan (39 static files) | No server-only key names, OpenAI/Clerk credential patterns, or private-key markers found. |
| API `GET /api/health/ready`, `/api/health/live`, and `/` | All returned HTTP 200 on a temporary local API process using a fresh SQLite database. |
| `git diff --check` | Exit 0; only the repository's normal Windows line-ending conversion notices were printed. |

### Security and deployment blockers

- A security review identified that Compose's initial published ports and demo-on defaults could expose an unauthenticated local stack on an untrusted network. The Compose host ports now bind to `127.0.0.1`, and `DEMO_MODE` defaults to false unless explicitly enabled in the local `.env`; Compose syntax was revalidated. Do not enable demo mode on a network-accessible deployment.
- The dependency audits are not clean. The two critical Next.js advisories require a major framework upgrade beyond the pinned Next.js 14 line; the Python report also contains known advisories in pinned runtime and development packages. These need a compatibility-tested remediation before production deployment.
- The historical secret-pattern matches are dummy test values, not credentials. They were replaced in the current fixture; no actual credentials were printed or detected in current source or the built web bundle.
- The Playwright journey validates the simulated path only. It does not fabricate or display a sample score, does not generate a report from a demo session, and does not claim live Agora, OpenAI, Clerk, or PostgreSQL behavior.
- The CI workflow and deployment configuration exist, but GitHub CI, container builds, and any production URL remain unverified.

### Prioritized remaining work

1. Resolve the audited frontend and Python dependency vulnerabilities with compatibility checks and rerun both audits.
2. Restore Docker Engine; build and start the Compose stack, then verify PostgreSQL/pgvector migrations and all service health checks.
3. Configure Clerk, OpenAI, and Agora credentials in a safe test environment; verify hosted auth, real report persistence, and a manual voice interview without exposing keys.
4. Run the checked-in workflow on GitHub and address any CI-only issues.
5. Keep the shared demo user local-only; use separate authenticated accounts for a browser-level user-isolation E2E.
