# VoiceHire

**Deliberate practice. Honest feedback.**

VoiceHire is an AI voice interview coach: the candidate practises a spoken interview,
gets adaptive follow-up questions, and receives an honest, transparent performance report
with a 7-day coaching plan.

## Screenshots

Responsive screenshots at 375 / 768 / 1440 px live in [`docs/screenshots/`](./docs/screenshots/):

| Screen | 375 px | 768 px | 1440 px |
|--------|--------|--------|---------|
| Landing | [landing-375](./docs/screenshots/landing-375.png) | [landing-768](./docs/screenshots/landing-768.png) | [landing-1440](./docs/screenshots/landing-1440.png) |
| Dashboard | [dashboard-375](./docs/screenshots/dashboard-375.png) | [dashboard-768](./docs/screenshots/dashboard-768.png) | [dashboard-1440](./docs/screenshots/dashboard-1440.png) |
| Onboarding | [onboarding-375](./docs/screenshots/onboarding-375.png) | [onboarding-768](./docs/screenshots/onboarding-768.png) | [onboarding-1440](./docs/screenshots/onboarding-1440.png) |
| Interview prepare | [interview-prepare-375](./docs/screenshots/interview-prepare-375.png) | [interview-prepare-768](./docs/screenshots/interview-prepare-768.png) | [interview-prepare-1440](./docs/screenshots/interview-prepare-1440.png) |
| Interview live | [interview-live-375](./docs/screenshots/interview-live-375.png) | [interview-live-768](./docs/screenshots/interview-live-768.png) | [interview-live-1440](./docs/screenshots/interview-live-1440.png) |
| Report (demo) | [report-demo-no-evaluation-375](./docs/screenshots/report-demo-no-evaluation-375.png) | [report-demo-no-evaluation-768](./docs/screenshots/report-demo-no-evaluation-768.png) | [report-demo-no-evaluation-1440](./docs/screenshots/report-demo-no-evaluation-1440.png) |

## 3-command demo quickstart

No credentials are required to run the full demo locally. The backend runs in
`C:\venvs\voicehire` (Python 3.12 venv); do **not** use `apps/api/.venv` (blocked by
Windows Application Control on `.exe` launchers — use `python -m` module form).

```powershell
# 0. Set the venv on PATH (do this in every terminal)
$env:Path = "C:\venvs\voicehire\Scripts;" + $env:Path

# 1. Install frontend dependencies
pnpm install --frozen-lockfile

# 2. Install backend dependencies into the API venv
python -m pip install -e "apps/api[dev]"

# 3. Start API on port 8000 (no --reload for live demo runs)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
# (in a second terminal) Start web on port 3000
pnpm --filter @voicehire/web dev --port 3000
```

Then open <http://localhost:3000>. The API readiness endpoint is at
<http://127.0.0.1:8000/api/health/ready>. Ollama (`llama3.2:1b`) is the default LLM
provider and runs locally with zero API keys. When Ollama output fails schema
validation, a deterministic fallback produces a report clearly labelled
`demo-quality`. No API keys are needed for the full interview-to-report flow.

## Environment variables

Copy `.env.example` to `.env.local` (never commit populated secrets). Server-only keys
must never be exposed through `NEXT_PUBLIC_*` variables.

### Required for local demo (none — demo mode works with zero credentials)

| Variable | Purpose | Default |
|----------|---------|---------|
| `APP_ENV` | Runtime mode | `development` |
| `DEMO_MODE` | Enables local demo without API keys | `true` |
| `DATABASE_URL` | SQLAlchemy async database URL | `sqlite+aiosqlite:///./voicehire_local.db` |
| `NEXT_PUBLIC_DEMO_MODE` | Tells the web client demo mode is on | `true` |

### Optional provider keys

| Variable | Purpose | Required for |
|----------|---------|--------------|
| `GROQ_API_KEY` | Groq LLM API key | Required for full-quality AI evaluation |
| `GROQ_BASE_URL` | Groq API base URL (or any OpenAI-compatible endpoint via `LLM_BASE_URL`) | `https://api.groq.com/openai/v1` |
| `GROQ_FAST_MODEL` | Groq fast model for live turns | `llama-3.1-8b-instant` |
| `GROQ_STRONG_MODEL` | Groq strong model for reports | `llama-3.3-70b-versatile` |
| `LLM_API_KEY` | Generic key for any OpenAI-compatible endpoint (falls back to `GROQ_API_KEY`) | — |
| `LLM_BASE_URL` | Base URL for any OpenAI-compatible endpoint (falls back to `GROQ_BASE_URL`) | — |
| `LLM_MODEL_LIVE` | Live-turn model for any endpoint (falls back to `GROQ_MODEL_LIVE`) | — |
| `LLM_MODEL_REPORT` | Report model for any endpoint (falls back to `GROQ_MODEL_REPORT`) | — |
| `DEEPGRAM_API_KEY` | Deepgram STT API key | Live voice transcription |
| `DEEPGRAM_MODEL` | Deepgram model | `nova-3` |
| `OLLAMA_BASE_URL` | Local Ollama endpoint | `http://localhost:11434` |
| `OLLAMA_MODEL` | Local Ollama model | `llama3.2:1b` |
| `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE` | Agora RTC credentials | Real-time voice (optional) |
| `CLERK_SECRET_KEY` / `CLERK_JWT_JWKS_URL` | Clerk auth credentials | Hosted sign-in/sign-up (optional) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client key | Hosted auth (optional) |

### Provider selection

- **LLM:** `LLM_PROVIDER=auto` prefers Groq when `GROQ_API_KEY` (or `LLM_API_KEY`) is set, falls back to Ollama when available, otherwise runs labeled demo/text-only mode.
- **LLM without keys:** Ollama (`llama3.2:1b`) runs locally. Evaluation uses structured output (`format` JSON schema) split into three smaller calls merged in code; when validation fails, a deterministic fallback from measured metrics produces a report labelled `demo-quality` (`quality_tier` field). The full interview-to-report flow works keyless.
- **LLM with OpenAI-compatible key:** Set `LLM_PROVIDER=openai_compatible`, `LLM_BASE_URL` (e.g. `https://generativelanguage.googleapis.com/v1beta/openai/` for Gemini), `LLM_API_KEY`, `LLM_MODEL_LIVE`, `LLM_MODEL_REPORT`. The Gemini Flash model name is not pinned in the repo — verify the current model name in Google AI Studio docs before setting `LLM_MODEL_LIVE`/`LLM_MODEL_REPORT`.
- **STT:** `STT_PROVIDER=deepgram` requires `DEEPGRAM_API_KEY`; otherwise browser Web Speech API is used.
- **Database:** SQLite locally (`./voicehire_local.db`), PostgreSQL deployed via `DATABASE_URL`.

### Guest identity and two-step question flow

All API calls require a guest identity. Pass an `X-Guest-Id` header (UUID v4) on every request — the same header value must be used across session creation, start, transcript, generate-question, end, and report endpoints. Follow-up questions use a two-step flow: `POST /api/interviews/sessions/{id}/transcript` records the candidate's answer and sets state to `processing_response`; then `POST /api/interviews/sessions/{id}/generate-question` (with `candidate_transcript` matching the saved answer) generates the next question and advances to `interviewing`.

### Keyless demo (what works with zero credentials)

The quickstart runs entirely without API keys using Ollama:

- **Interview:** Real Q&A flow via Ollama `llama3.2:1b` (not simulated). Follow-up questions are generated per turn.
- **Report:** Structured evaluation via Ollama with deterministic fallback. When Ollama output validates, `quality_tier: "ai-generated"`; when it fails, `quality_tier: "demo-quality"` with scores derived from measured metrics. Either way, a report is always produced.
- **Voice:** Browser Web Speech API STT is available; Deepgram requires a key. Browser `speechSynthesis` TTS is client-side.
- **Auth:** Guest sign-in (no Clerk) always works via `X-Guest-Id` header.

See [`.env.example`](.env.example) for the full commented template and
[`docs/setup/SETUP_GUIDE.md`](docs/setup/SETUP_GUIDE.md) for Windows PowerShell and
Linux/macOS setup.

## Architecture

| Layer | Choice | Notes |
|-------|--------|-------|
| Web | Next.js 15.5 (App Router), TypeScript, Tailwind | Package: `@voicehire/web`, port 3000 |
| API | FastAPI (Python 3.11+), SQLAlchemy async, Alembic | Package: voicehire-api, port 8000 |
| Database | SQLite locally, PostgreSQL deployed | Via `DATABASE_URL` |
| LLM | Groq via OpenAI-compatible API; Ollama local fallback | Fast model for live turns, strong model for reports; Ollama is keyless. Evaluation uses structured output (JSON schema) split into three smaller calls merged in code; deterministic fallback labelled `demo-quality` when Ollama output fails validation. |
| STT | Deepgram Nova-3 (backend prerecorded REST); browser Web Speech fallback | |
| TTS | Browser `speechSynthesis` | Voice selection, rate control, cancel on interruption |
| RTC | Agora, optional | Interview works without Agora credentials |
| Auth | Guest (X-Guest-Id UUID v4, localStorage + HttpOnly cookie); Clerk optional | Local no-Clerk demo sign-in always supported |
| Hosting | Vercel (web) + public host for API | |

Provider abstraction: one implementation per provider plus a demo/mock implementation,
selected by env vars. `/api/health/ready` reports each provider truthfully as `ok`,
`disabled`, or `error`. Demo mode never requires credentials.

## Verification

Run from the repository root (Windows PowerShell):

```powershell
# Set the venv on PATH (do this in every terminal)
$env:Path = "C:\venvs\voicehire\Scripts;" + $env:Path

# Frontend
pnpm --filter @voicehire/web type-check   # tsc --noEmit
pnpm --filter @voicehire/web lint         # ESLint
pnpm --filter @voicehire/web test         # Vitest (30 tests)
pnpm --filter @voicehire/web build        # Next.js build

# Backend (Python 3.12 venv at C:\venvs\voicehire)
python -m pip check                       # verify dependencies
python -m pytest apps\api\tests -q        # 107 tests

# Git hygiene
git diff --check                          # clean
```

Never run `pytest.exe`, `pip.exe`, or `uvicorn.exe` directly — Windows Application
Control blocks `.exe` launchers in the venv. Use `python -m pytest`, `python -m pip`,
`python -m uvicorn` instead.

For live demo runs, start the API **without** `--reload` (reload restarts the server on
every file edit and kills long Ollama calls). Restart manually after edits.

Baseline at last verification: type-check, lint, build, 30 Vitest tests, 107 pytest
tests all passing; `git diff --check` clean. Playwright browser tests are blocked on
this 8 GB dev machine by OOM kills when Node.js + Python + Ollama run simultaneously;
the full interview-to-report flow was verified via direct API calls instead.

## Roadmap

Done in order, one phase per session:

1. **Free-tier provider layer** — LLM/STT abstraction, Groq + Deepgram, browser TTS,
   optional Agora, truthful health checks, quota handling, tests. ✅
2. **Design system rollout** — tokens, primitives, all screens, before/after screenshots. ✅
3. **Real-key verification** — Groq key in `.env.local` for full-quality AI evaluation.
   Ollama (`llama3.2:1b`) works keyless; record both in the checklist.
   🔑 Needs a Groq key added to `.env.local` by the user.
4. **README rewrite** — pitch, screenshots, 3-command demo quickstart, env table
   (required vs optional), architecture, test commands, roadmap, licence. ✅
5. **CI green** — `.github/workflows/ci.yml` runs install, type-check, lint, test, build,
   pytest, Playwright in demo mode. ✅
6. **PR and merge** into the default branch. ⬜
7. **Deploy** — web on Vercel, API on a public host with PostgreSQL, demo mode first. ⬜
8. **Final check** on a phone against the live URL. ⬜

## Provider rules

- All providers sit behind an abstraction in `apps/api`: one implementation per provider
  plus one demo/mock implementation. Select by env vars. Never hardcode a provider.
- Handle 429 and quota errors: retry once with backoff, then show a clear message and
  offer the text-input fallback or demo mode. Never crash the interview.
- Every report states which provider and model produced it. Ollama reports carry
  `quality_tier: "ai-generated"` when Ollama output validated, or
  `quality_tier: "demo-quality"` when a deterministic fallback was used.
- CORS origins come from env, never `*` in production.

## Security and privacy

- Keys live in `.env.local` (local), Vercel env vars (web), and the API host's variables.
  Never log keys, tokens, transcripts, or resume text in plain output.
- Demo data is simulated and labelled; users are told not to enter real candidate data
  in demo mode.
- Keep dependencies patched. Do not downgrade to silence an advisory.

## Licence

No licence file is present in this repository. Contact the repository owner before
reusing or distributing.
