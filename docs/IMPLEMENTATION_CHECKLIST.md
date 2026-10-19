# Implementation Checklist and Baseline

Baseline recorded on 2026-10-14 on branch `feat/finish-voicehire`; dependency remediation was revalidated on 2026-10-16.

## Current interview-flow task

### Implemented and verified

- Interview lifecycle endpoints use the persisted `created`, `ready`, `connecting`, `interviewing`, `processing_response`, `completed`, `failed`, and `cancelled` state machine. Start/end repetition, invalid transcript timing, transition history, timestamps, and question-budget completion are covered by API tests.
- Session setup accepts candidate resume text plus a job description or category, and persists a blueprint before starting. Difficulty, duration, interview type, job context, experience level, persona, and explicit demo flag are stored and returned by the API; the web client maps the returned values on reload rather than substituting defaults.
- Text answers are persisted before the API requests the next question. The provider receives the static, versioned interviewer rules as system content and blueprint/conversation data as user content. FakeProvider tests cover answer-grounded follow-ups, short/uncertain answers, injection attempts, and bounded question budgets.
- Simulated interviews require explicit `is_demo`, use FakeProvider only when demo mode is enabled, return `is_demo` and `source`, mark every transcript `source="simulated"`, show a “Simulated demo” UI badge, and cannot produce evaluations or enter real report listings.
- Fabricated demo transcripts/metrics were removed. Evaluation reports return explicit `insufficient data`; transcript/timing analytics expose only defined evidence-based metrics, with null values and reasons when evidence is missing, and identify simulated data.
- Frontend interview setup/live/prepare/complete screens use the API service, require pasted resume text, accept job-description text or a category, and no longer use canned questions, simulated candidate answers, guessed question totals, or hardcoded fit scores.
- Backend regression suite passes: 45 tests, including end-to-end text interview lifecycle, report schema/fairness validation, persisted report idempotency, demo isolation, coaching progress, SQLite migration checks, and Clerk JWT algorithm validation.

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
| `python -m pytest tests\\ -v` (from `apps/api`) | Latest exit 0; 45 passed, 39 warnings. |
| `pnpm --filter @voicehire/web type-check` | Exit 0 (`tsc --noEmit`). |
| `pnpm --filter @voicehire/web lint` | Latest exit 0; no ESLint warnings or errors. |
| `pnpm --filter @voicehire/web build` | Latest exit 0; Next.js 15.5.28 generated 18 application routes. |
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
| `python -m pytest tests\\ -v` (from `apps/api`, Python 3.12) | Latest exit 0; 45 passed, 39 warnings. Includes evaluator schema/fairness retries, missing-data nulls, measured-metric fixture, persisted report reload/idempotency, ownership, demo isolation, coaching progress, SQLite migration up/down, and Clerk JWT verification. |
| `pnpm --filter @voicehire/web type-check` | Exit 0 (`tsc --noEmit`). |
| `pnpm --filter @voicehire/web lint` | Latest exit 0; no ESLint warnings or errors. |
| `pnpm --filter @voicehire/web test` | Exit 0; 2 mocked Agora hook tests passed. |
| `pnpm --filter @voicehire/web build` | Latest exit 0; Next.js 15.5.28 generated 18 application routes. |
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
| `python -m pytest tests\\ -v` (from `apps/api`, Python 3.12) | Latest exit 0; 45 passed, 39 warnings. Includes SQLite migration up/down, voice metrics, token authorization/expiry, duplicate transcript handling, WebSocket replay/isolation, demo interview flow, and Clerk JWT verification. |
| `pnpm --filter @voicehire/web type-check` | Exit 0 (`tsc --noEmit`). |
| `pnpm --filter @voicehire/web lint` | Latest exit 0; no ESLint warnings or errors. |
| `pnpm --filter @voicehire/web test` | Exit 0; 2 mocked Agora hook tests passed (join/mute/cleanup and microphone permission denial). |
| `pnpm --filter @voicehire/web build` | Latest exit 0; Next.js 15.5.28 generated 18 application routes. |

### Earlier revalidation on 2026-10-15 (superseded by latest results below)

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
- Service error handling has Vitest coverage. Playwright smoke tests cover the landing page, local demo onboarding, and a simulated interview. The local demo browser journey passed; hosted Clerk authentication remains credential-blocked.
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
- Root `pnpm lint` is not clean: Pylint exits 28 with a 7.22/10 score. Frontend lint passes without warnings.

### Missing

- The Playwright local-demo interview journey passes. Hosted Clerk browser authentication remains unverified because Clerk credentials are unavailable locally.
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
| `pnpm --filter @voicehire/web lint` | Latest exit 0; no warnings or errors. |
| `pnpm --filter @voicehire/web build` | Latest exit 0; Next.js 15.5.28 compiled and generated 18 application routes. |
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
| `python -m pytest tests/ -q` (from `apps/api`) | Latest exit 0; 45 passed, 39 warnings. |
| `alembic upgrade head` then `alembic downgrade base` (fresh SQLite DB) | Both exited 0, including the user-preferences migration. |
| `pnpm --filter @voicehire/web exec playwright test --workers=1` | Latest exit 0; 3 passed (landing, local demo onboarding, simulated interview persistence/end/evaluation isolation). |
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
| `pnpm --filter @voicehire/web build` | Latest exit 0; Next.js 15.5.28 built 18 application routes. |
| `apps\\api\\.venv\\Scripts\\python.exe -m pip install -e "apps\\api[dev]"` | Exit 0 after updating Requests to 2.33.0. |
| `apps\\api\\.venv\\Scripts\\python.exe -m pytest apps\\api\\tests -q` | Latest exit 0; 45 passed, 39 warnings. |
| `docker compose config --quiet` | Exit 0 after local-only port bindings and demo-off Compose defaults. |
| `docker info --format '{{.ServerVersion}}'` | Docker Engine unavailable: API call to `//./pipe/dockerDesktopLinuxEngine` returned HTTP 500. |
| `pnpm audit --prod` | Initial: 30 findings (2 critical, 12 high, 13 moderate, 3 low). After Next.js 15.5.28 migration: 4 PostCSS findings (2 high, 2 moderate). After workspace override to PostCSS 8.5.28: exit 0, no known production vulnerabilities. |
| `pip-audit --path apps\\api\\.venv\\Lib\\site-packages --timeout 60` | Exit 1; initial: 60 records across 12 packages. Latest: 10 records in Starlette 0.49.1 only; Requests 2.33.0 no longer has a finding. Starlette advisories list fixes only in 1.x; they are deferred because FastAPI 0.121.3 requires Starlette `<0.50`. The affected StaticFiles, HTTPEndpoint, and form parsing paths are not used. The editable API package is skipped because it is not a PyPI distribution. |
| Local credential-pattern scan (138 non-ignored working files) | No credential-shaped matches after replacing the test-only placeholder. |
| Git-history credential-pattern scan (3,811,894 patch bytes) | Four OpenAI-shaped matches were confined to prior test-fixture placeholders in `apps/api/tests/conftest.py`; no production credential pattern was found. This scan does not rewrite history. |
| Built browser bundle scan (39 static files) | No server-only key names, OpenAI/Clerk credential patterns, or private-key markers found. |
| API `GET /api/health/ready`, `/api/health/live`, and `/` | All returned HTTP 200 on a temporary local API process using a fresh SQLite database. |
| `git diff --check` | Exit 0; only the repository's normal Windows line-ending conversion notices were printed. |

### Security and deployment blockers

- A security review identified that Compose's initial published ports and demo-on defaults could expose an unauthenticated local stack on an untrusted network. The Compose host ports now bind to `127.0.0.1`, and `DEMO_MODE` defaults to false unless explicitly enabled in the local `.env`; Compose syntax was revalidated. Do not enable demo mode on a network-accessible deployment.
- The production pnpm audit is clean. The Python audit still reports 10 records for Starlette 0.49.1. A Starlette 1.x upgrade is deferred pending a compatible FastAPI upgrade and broader regression validation; the backend dependency audit is not clean.
- The historical secret-pattern matches are dummy test values, not credentials. They were replaced in the current fixture; no actual credentials were printed or detected in current source or the built web bundle.
- The Playwright journey validates the simulated path only. It does not fabricate or display a sample score, does not generate a report from a demo session, and does not claim live Agora, OpenAI, Clerk, or PostgreSQL behavior.
- The CI workflow and deployment configuration exist, but GitHub CI, container builds, and any production URL remain unverified.

### Prioritized remaining work

1. Evaluate a coordinated FastAPI/Starlette 1.x upgrade and its regression risk.
2. Restore Docker Engine; build and start the Compose stack, then verify PostgreSQL/pgvector migrations and all service health checks.
3. Configure Clerk, OpenAI, and Agora credentials in a safe test environment; verify hosted auth, real report persistence, and a manual voice interview without exposing keys.
4. Run the checked-in workflow on GitHub and address any CI-only issues.
5. Keep the shared demo user local-only; use separate authenticated accounts for a browser-level user-isolation E2E.

## Local web development fixes (2026-10-17)

### Implemented and verified

- `/sign-in` and `/sign-up` use the shared auth-mode helper and render Clerk components only when Clerk auth is configured. Middleware now also reads the explicit server runtime flags so local demo navigation is not redirected back to sign-in.
- The API-unreachable demo banner is development-only, aborts its request on timeout/unmount, and uses a small explanatory pill. Production only displays it when the API explicitly reports demo mode.
- The root layout suppresses the expected HTML hydration warning. Native development defaults and documentation use API port `8000`; API CORS allows both `http://localhost:3000` and `http://127.0.0.1:3000`.
- The landing page now has a centered hero, product preview, three-step explanation, feature cards, footer, and explicit simulated-versus-real limitations.
- `next@15.5.28` is already the latest 15.5.x patch; no package upgrade was needed.
- The final browser suite verifies landing, no-Clerk sign-in without runtime errors, local-demo onboarding persistence, and a simulated interview through answer, reload, end, and report/coaching isolation.

### Final command results

| Command / check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Exit 0; all four workspace projects already up to date. |
| `pnpm --filter @voicehire/web type-check` | Exit 0 (`tsc --noEmit`). |
| `pnpm --filter @voicehire/web lint` | Exit 0; no ESLint warnings or errors. Next prints that `next lint` is deprecated. |
| `pnpm --filter @voicehire/web test` | Exit 0; 8 tests passed across 3 files. |
| `pnpm --filter @voicehire/web build` | Exit 0 on Next.js 15.5.28; 18 application routes generated. |
| `python -m pytest tests/ -v` (from `apps/api`) | Exit 0; 45 passed, 39 deprecation warnings, 293.01s. |
| `pnpm --filter @voicehire/web exec playwright test --workers=1` | Final run exit 0; 4 passed in 1.6m. An earlier run timed out waiting for the Playwright web server; the rerun completed successfully. |
| `pnpm dev` with a fresh SQLite URL; API ready/live and web `/` | Previously verified in this task; each endpoint returned HTTP 200. The existing unstamped legacy SQLite database remains untouched. |
| `git diff --check` | Exit 0; Git reports only Windows line-ending conversion notices. |

### Still unverified

- Clerk-hosted authentication still requires test keys; live Agora voice and OpenAI output require their respective credentials.
- Docker/PostgreSQL, GitHub Actions execution, and deployment remain unverified as described in the whole-system baseline above.

## CI failure reproduction and fixes (2026-10-18)

### Workflow commands

The checked-in `.github/workflows/ci.yml` runs:

- Frontend: `pnpm --filter @voicehire/web type-check`, `pnpm --filter @voicehire/web lint`, and `pnpm --filter @voicehire/web build`.
- Browser tests: `pnpm --filter @voicehire/web test:e2e` after installing Chromium and API dependencies.
- API tests: `python -m pytest tests/ -v` from `apps/api`.

### Root causes and changes

- The landing page product-preview markup closed a `Card` in place of an inner `div`, then left an extra closing `div` before the section end. TypeScript, ESLint, Next build, and Next dev all rejected the malformed JSX. Restored the intended nesting; frontend type-check, lint, and build now pass.
- The demo navigation assertion used Playwright's default 5-second URL timeout, and one full run timed out while loading `/onboarding`. The response was HTTP 200 when rerun independently; raised this specific navigation assertion timeout to 30 seconds without changing auth or skipping the route.
- The live-room E2E asserted the typed-answer field before starting the interview, although the UI only presents answer controls after the interview starts. It also used a broad microphone-warning selector that matched both the warning and a separate status message. The test now matches the warning text exactly, starts the interview before checking the input, and asserts the truthful `Ready for your answer` state rather than `AI speaking` in text-only mode.
- No API changes were made. Existing API tests remain green.

### Reproduction and final verification

| Command / check | Result |
|---|---|
| `pnpm --filter @voicehire/web type-check` before fixing JSX | Failed with TS2657 and unmatched JSX-tag errors in `apps/web/app/page.tsx` (lines 88, 196–197, 289–290). |
| `pnpm --filter @voicehire/web lint` before fixing JSX | Failed parsing `apps/web/app/page.tsx` at line 196: expected closing `section`. |
| `pnpm --filter @voicehire/web build` before fixing JSX | Failed compilation at `apps/web/app/page.tsx:196` due unexpected JSX closing markup. |
| `pnpm --filter @voicehire/web test:e2e -- --workers=1` before E2E corrections | Failed: one onboarding URL timeout and one ambiguous microphone-message locator. A subsequent run also showed the answer field was expected before interview start. |
| `pnpm --filter @voicehire/web type-check` after fixes | Exit 0. |
| `pnpm --filter @voicehire/web lint` after fixes | Exit 0; no ESLint warnings or errors (Next reports `next lint` deprecated). |
| `pnpm --filter @voicehire/web build` after fixes | Exit 0; Next.js 15.5.28 compiled and generated 18 routes. |
| `pnpm --filter @voicehire/web test` | Exit 0; 8 tests passed across 3 files. |
| `pnpm --filter @voicehire/web test:e2e -- --workers=1` | Exit 0; 4 tests passed. |
| Exact CI command `pnpm --filter @voicehire/web test:e2e` | Exit 0; 4 tests passed in 2.1 minutes, 1 worker (the config has one spec file and `fullyParallel: false`). |
| `apps\api\.venv\Scripts\python.exe -m pytest apps\api\tests\ -v` | Exit 0; 45 passed, 40 warnings in 25.81s. No API code changed. |
| `git diff --check` | Exit 0; only Windows line-ending notices for the existing modified live interview file. |

## Landing-page staged recovery and screenshot cleanup (2026-10-18)

- Restored `apps/web/app/page.tsx` from `HEAD`. The requested step 3 changes were already part of `HEAD`: `ButtonLink`/`Card` imports, a single “Try demo interview” CTA targeting `/sign-in`, the simulated-data disclaimer, and a correctly nested `<Card>` preview wrapper. No landing-page edits or per-step commits were needed; no-op commits were not created.
- The live interview page remained in `HEAD`; type-check and lint both passed after the restore, so it was retained.
- Removed `apps/web/e2e/before-landing-375.png`. Added `.playwright-mcp/` to `.gitignore` and removed its previously tracked screenshot/snapshot artifacts from the Git index. The local ignored `.playwright-mcp` data is left in place.

### Verification

| Command / check | Result |
|---|---|
| `pnpm --filter @voicehire/web type-check` after restoring landing page | Exit 0. |
| `pnpm --filter @voicehire/web lint` after restoring landing page | Exit 0; no ESLint warnings/errors (Next prints the `next lint` deprecation notice). |
| `pnpm --filter @voicehire/web type-check` final | Exit 0. |
| `pnpm --filter @voicehire/web lint` final | Exit 0; no ESLint warnings/errors. |
| `pnpm --filter @voicehire/web test` | Exit 0; 8 tests passed across 3 files. |
| `pnpm --filter @voicehire/web build` | Exit 0; Next.js 15.5.28 generated 18 routes. |
| `pnpm --filter @voicehire/web test:e2e -- --workers=1` | Exit 0; all 4 browser tests passed in 2.4 minutes. |
| `git check-ignore .playwright-mcp/before-live-375.png` | Correctly ignored by `.playwright-mcp/`. |
| `Test-Path apps\web\e2e\before-landing-375.png` | `False`; requested screenshot removed. |

## Report, LAN, and secure-context verification (2026-10-18)

- Report detail renders a persisted AI score summary, strengths, weaknesses/missing elements, and a seven-day coaching grid using shared `Card` primitives. Only stored coaching exercises are populated; absent days state that no task was returned, and an unavailable plan is reported rather than fabricated.
- The browser API service and Agora token request default to an empty API base, so they use relative `/api` paths. `next.config.js` rewrites `/api/:path*` to the server-only `API_INTERNAL_URL` backend origin. `useInterviewWebSocket` defaults to the current page origin and switches `http:` to `ws:` and `https:` to `wss:`.
- `rg 'localhost|127\.0\.0\.1' apps/web` still reports the server-side development proxy fallback and the deliberately isolated loopback hosts/assertion in Playwright configuration. It also matches the user-facing secure-context text and its assertions. These are not browser API base URLs; the root `.env.example` now leaves `NEXT_PUBLIC_API_URL` blank by default so LAN browsers use the same-origin proxy.
- Both interview prepare and live screens check `window.isSecureContext`, explain “Microphone needs HTTPS or localhost,” and leave typed answers available. The Playwright demo-flow test exercises an insecure context and confirms its text fallback.
- `SETUP_GUIDE.md` now documents `DEV_ALLOWED_ORIGINS` for a LAN IP, private-profile Windows firewall rules, `next dev --experimental-https`, and the risks of HTTPS tunnels.

### Verification

| Command / check | Result |
|---|---|
| `rg 'localhost|127\.0\.0\.1' apps/web` | Matches limited to Next's internal dev proxy fallback, Playwright loopback setup/assertion, microphone copy and related assertions; no browser-service absolute loopback API URL. |
| Report source inspection | Score summary, strengths, weaknesses, seven plan-day slots, and shared `Card` usage present in `apps/web/app/reports/[id]/page.tsx`. |
| Proxy/WebSocket source inspection | `/api/:path*` rewrite and current-origin `ws:`/`wss:` derivation confirmed. |
| Secure-context source inspection | Prepare/live warnings and text-answer fallback confirmed; Playwright covers insecure live flow. |
| Setup-guide source inspection | Firewall, allowed dev origins, HTTPS dev cert and tunnel instructions present. |
| `pnpm --filter @voicehire/web type-check` after each documentation/config edit | Exit 0 after each edit. |

## Frontend and E2E CI Node compatibility (2026-10-19)

- `verify-frontend` and `verify-e2e` both failed during `pnpm/action-setup`'s pnpm store lookup, before dependency installation or test commands. The workflow installed Node 20.20.2 while pinning pnpm 11.24.0, which requires Node 22.13 or later and then failed loading the unsupported `node:sqlite` built-in.
- Updated both affected workflow jobs to install Node 24. The Python API matrix jobs were not changed; the reported 3.11 and 3.12 jobs had passed.

### Verification

| Command / check | Result |
|---|---|
| `pnpm install --frozen-lockfile` (Node 24, pnpm 11.24.0) | Exit 0; all 4 workspace projects already up to date. |
| `pnpm --filter @voicehire/web type-check` | Exit 0. |
| `pnpm --filter @voicehire/web lint` | Exit 0; no ESLint warnings or errors. Next prints the existing `next lint` deprecation notice. |
| `pnpm --filter @voicehire/web build` | Exit 0; Next.js 15.5.28 compiled and generated 18 routes. |
| `pnpm --filter @voicehire/web test:e2e -- --workers=1` | Exit 0; all 4 Playwright tests passed. |
