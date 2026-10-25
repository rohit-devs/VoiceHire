# VOICEHIRE_AUDIT.md — Phase 1 Audit

Status: **GATE 1 complete** — "Failed to fetch" root cause CONFIRMED with evidence.
Repo: `C:\VoiceHire`, branch `feat/remove-auth`.

## 0. Snapshot

- Branch: `feat/remove-auth` (never on `main`; commits use conventional messages)
- Last commit: `5f3f378` feat: add live interview page with real-time audio and transcription support
- Pre-existing untracked (not created by this session, left untouched): `.kilo/`, `HACKATHON_ASSESSMENT.md`, `apps/hackathon/`
- `.env` and `.env.local` are git-ignored; may exist locally with populated provider keys. Contents were NOT read (secrets are radioactive). Config values observed only through running-app behavior.
- Servers already running (pre-existing): API `http://127.0.0.1:8000` (demo mode), Web `http://127.0.0.1:3000` (Next.js dev).

## 1. Baseline test counts (before any fix)

| Check | Command | Result |
|---|---|---|
| Backend pytest | `apps\api\.venv\Scripts\python.exe -m pytest apps\api\tests -q` | **65 passed** (AGENTS.md's "45" baseline is stale) |
| Frontend type-check | `pnpm --filter @voicehire/web type-check` | **pass** (tsc --noEmit, no errors) |
| Frontend lint | `pnpm --filter @voicehire/web lint` | **pass** (no ESLint warnings/errors) |
| Frontend vitest | `pnpm --filter @voicehire/web test` | **10 passed** (3 files; AGENTS.md's "8" is stale) |
| Production build | `pnpm --filter @voicehire/web build` | **pass**, 16 routes compiled (AGENTS.md's "18" is stale) |

## 2. Confirmed root cause — "Interview saved" + evaluation failure (P0)

**Failing request (exact):**
```
POST /api/evaluations/sessions/{sessionId}/report/generate
```
with header `x-guest-id: <uuid>` and body `{}`.

**Observed behavior:** `GET /api/interviews/sessions/{id}` → `200 OK` (session loads, `is_demo:false`, `current_state:completed`). Then `POST .../report/generate` → **HTTP 500 Internal Server Error**, body `text/plain: "Internal Server Error"` (uvicorn unhandled-exception response, no JSON detail).

**Frontend manifestation:** `apiInterviewService.generateEvaluation` throws; `request()` cannot parse the 500 as JSON (`res.json()` rejects, content-type is text/plain), so it throws `Error("Internal Server Error")`. The completion page (`apps/web/app/interview/complete/[id]/page.tsx`) renders `<h1>Interview saved</h1>` plus the error message regardless — success UI is shown before the server confirms, and the error text depends on what the backend returns.

**Root cause:** unhandled `TypeError: can't subtract offset-naive and offset-aware datetimes`.

Call chain:
1. `routers/evaluations.py:229` `generate_assessment(...)` → `evaluation_engine.py:248`
2. `evaluation_engine.py:248` `generate_assessment` calls `measured_evidence(session, transcripts)` at line 248/122
3. `evaluation_engine.py:135` `measured_evidence` passes `now=session.ended_at` to `calculate_voice_metrics`
4. `voice_metrics.py:69` `current_time = now or datetime.now(timezone.utc)` → `current_time` = `session.ended_at`, an **offset-naive** datetime read from SQLite (`"2026-10-24T22:28:40.159476"`, no tz)
5. `voice_metrics.py:71-72` `started_at` is normalized to UTC-aware (`replace(tzinfo=timezone.utc)`)
6. `voice_metrics.py:74` `current_time - normalized_start` → **naive − aware** → `TypeError`

This `TypeError` is not a `ProviderError`/`HTTPException`, so none of the `except` clauses in `evaluations.py` catch it. It propagates to FastAPI/uvicorn → HTTP 500.

**Evidence captured:**
- `curl -i POST .../report/generate` → `HTTP/1.1 500 Internal Server Error`, `content-type: text/plain; charset=utf-8`, body `Internal Server Error`
- Direct repro via `generate_assessment` against the real SQLite DB (`apps\api\voicehire_local.db`) printed the full traceback ending at `voice_metrics.py:74` `TypeError: can't subtract offset-naive and offset-aware datetimes`

**Files:** `apps/api/app/interview/voice_metrics.py:69-74`, `apps/api/app/interview/evaluation_engine.py:122,135,248`, `apps/api/app/routers/evaluations.py:218-229`
**Fix order:** 1 (must fix before any report/completion flow can work). **Dependencies:** none.

## 3. Additional confirmed issues (P1–P3)

| ID | Sev | Symptom | Confirmed root cause | Files | Fix order | Depends |
|---|---|---|---|---|---|---|
| A-2 | P1 | Completion page shows "Interview saved" before the server confirms; no retry, no loading/empty/error distinction | UI commits to "saved" state unconditionally after `useEffect` settles | `apps/web/app/interview/complete/[id]/page.tsx:43-70` | 2 | A-1 |
| A-3 | P1 | Base-URL handling: `NEXT_PUBLIC_API_URL` blank → relative fetch → Next.js rewrite to `http://127.0.0.1:8000`; LAN/127.0.0.1/localhost not unified, no same-origin-only guarantee | `API_URL` used raw; rewrite target hardcoded to IPv4 loopback | `apps/web/next.config.js:5-7,38-43`; `apps/web/lib/services/apiInterviewService.ts:19,43` | 3 | — |
| A-4 | P1 | No typed API-client error handling: no timeout, abort, retry-with-backoff (idempotent only), no structured error + Retry button | `request()` is a thin `fetch` wrapper | `apps/web/lib/services/apiInterviewService.ts:36-57` | 4 | — |
| A-5 | P1 | No real backend audio→text STT path: `/api/stt/transcribe` uses `BrowserSTT`, which raises `ProviderError("STT runs in the browser...")`; Deepgram provider exists but no key configured | STT provider resolves to `BrowserSTT` (client Web Speech API only) | `apps/api/app/providers/stt.py:83-103,93-103`; `apps/api/app/routers/stt.py:22-53`; `apps/web/lib/services/apiInterviewService.ts:68-85` | 5 | — |
| A-6 | P2 | Config inconsistency: `get_llm_provider` honors `settings.DEMO_MODE`; `get_stt_provider` reads only `os.getenv("DEMO_MODE")`, so the two disagree when `DEMO_MODE` is set in `.env` but not the shell env | `stt.py:97` uses `env_flag("DEMO_MODE")` instead of `settings.DEMO_MODE` | `apps/api/app/providers/stt.py:93-103` vs `apps/api/app/providers/llm.py:280-311` | 6 | — |
| A-7 | P2 | Coaching plan is a fixed 7-day list enumerated from exactly 7 `practice_exercises`; no date scheduler, difficulty ramp, spaced review, missed-day policy, or 12-day variant; plan data duplicated between `EvaluationReport.seven_day_coaching_plan` column and `coaching_plans` table | `_make_coaching_plan` always builds 7 days; no 12-day code exists | `apps/api/app/routers/evaluations.py:96-119`; `apps/api/app/models.py:212,274-288` | 7 | — |
| A-8 | P2 | Fixed opener missing: the live interview's first question was JD-specific ("challenges facing a modern-day software engineer"), not "Tell me about yourself." | Start flow generates a blueprint-driven question rather than a mandated opener | `apps/api/app/routers/interviews.py:450-610` (start); Phase 4 engine not present | 8 | — |
| A-9 | P3 | `/api/health/ready` is config-based: DB is actually pinged (`SELECT 1`), but LLM/STT/TTS/Agora report `ok`/`disabled` from configuration only, not live reachability | `provider_health()` constructs providers without calling the network | `apps/api/app/routers/health.py:22-45`; `apps/api/app/providers/__init__.py:36-52` | 9 | — |
| A-10 | P3 | Anonymous-session identity: frontend uses `X-Guest-Id` (localStorage UUID); backend accepts cookie first, then header, then creates a guest + Secure cookie. Cookie is Secure so it is not sent over `http://localhost:3000`; header path works but a stale/different cookie can override the localStorage guest ID across refreshes, breaking ownership | cookie precedence over header; Secure cookie not sent on insecure localhost | `apps/web/lib/guest.ts`; `apps/api/app/auth.py:86-145` | 10 | — |

## 4. Provider reality check

| Provider | Status | Evidence |
|---|---|---|
| Ollama (LLM) | **WORKING** | `LLM_PROVIDER=ollama`; `curl http://127.0.0.1:11434/api/tags` → 200, `llama3.2:1b` (1.2B Q8_0) and `qwen2.5-coder:3b` installed; `/api/health/ready` reports `llm: ok, using ollama` |
| Groq (LLM) | **ABSENT** | `GROQ_API_KEY` not set (`bool(settings.GROQ_API_KEY)` false); health: `groq: disabled`. No key available to test; do not fabricate. |
| Deepgram (STT) | **ABSENT** | `DEEPGRAM_API_KEY` not set; health: `deepgram: disabled`. Active STT is `BrowserSTT` (client Web Speech), not Deepgram. |
| Agora (RTC) | **ABSENT** | `AGORA_APP_ID`/`AGORA_APP_CERTIFICATE` not set; health: `agora: disabled`. |

## 5. STT path (real or TTS-only)

There is **no end-to-end backend audio→text path**. `/api/stt/transcribe` exists (`routers/stt.py`) but `get_stt_provider()` resolves to `BrowserSTT`, whose `transcribe()` raises `ProviderError("STT runs in the browser; send text instead of audio")`. Deepgram provider is implemented (`providers/stt.py:27-72`) but unconfigured (no key). The frontend `transcribeAudio` (`apiInterviewService.ts:68`) POSTs audio to `/api/stt/transcribe`, which will fail in the current config. STT is therefore client Web Speech API only; TTS is browser `speechSynthesis` (free default). Both need the Phase 3 pipeline.

## 6. 7-day / 12-day plan code

Only a **7-day plan** exists, built deterministically (but without dates/ramp/spaced review) from the 7 required `practice_exercises` in `_make_coaching_plan` (`evaluations.py:96-119`). No 12-day plan code exists anywhere in the repo. Plan data is stored twice: `EvaluationReport.seven_day_coaching_plan` JSON column and the `coaching_plans` table (`CoachingPlan.plan_data`). The `/coaching-plan` endpoints use the `coaching_plans` table. No scheduler, missed-day policy, or repeat-session regeneration logic is present.

## 7. Design tokens (source of truth — do not impose a new palette)

Tokens live in `apps/web/app/globals.css` and are mapped in Tailwind; shared primitives in `apps/web/components/ui/primitives.tsx`. Confirmed from rendered markup and AGENTS.md §8:
- `--bg-base #0a0a0a`, `--bg-elevated #0d0d0d`, `--bg-input #141414`, `--border #262626`, `--accent #e8321e`, `--accent-hover #ff3b2d`, text `#e5e5e5`/`#a3a3a3`/`#737373`, success/error/warning `#34d399`/`#f87171`/`#fbbf24`.
- Display font (Impact stack) for headlines; label style 0.28em tracking/12px/bold uppercase; body = system UI stack.

## 8. Auth / session state

Auth (Clerk/Better Auth) has been removed; every visitor is an anonymous guest. Identity is resolved by `get_current_user` (`apps/api/app/auth.py`): `vh_guest_id` Secure cookie → `X-Guest-Id` header → new guest + Secure cookie. Frontend sends `X-Guest-Id` from localStorage (`apps/web/lib/guest.ts`). Verified end-to-end with curl: create → start → transcript → end → get all succeed with a single consistent guest ID. Ownership is enforced server-side on every interview/evaluation/coaching-plan route.

## 9. Fix order (per gate)

1. A-1 — voice_metrics datetime TypeError (completion/report 500). Regression test first.
2. A-2 — completion page only shows "saved" after server confirmation; structured error + Retry.
3. A-3 — base-URL / same-origin proxy consistency.
4. A-4 — typed API client: timeout/abort/retry (idempotent only), error display + Retry.
5. A-5 — backend STT path (Phase 3).
6. A-6 — STT demo-mode config inconsistency.
7. A-7 — coaching plan scheduler (Phase 6).
8. A-8 — fixed opener (Phase 4).
9. A-9 — truthful health checks (Phase 9).
10. A-10 — guest-identity cookie/header consistency (Phase 2).

## 10. Gate 1 verdict

**GATE 1 PASSED.** Audit complete. The "Failed to fetch" symptom is confirmed: the completion page's `generateEvaluation` call (`POST /api/evaluations/sessions/{id}/report/generate`) returns HTTP 500 due to an unhandled `TypeError: can't subtract offset-naive and offset-aware datetimes` in `calculate_voice_metrics` (`voice_metrics.py:74`), triggered because `measured_evidence` passes the naive `session.ended_at` as `now` while `started_at` is normalized to UTC-aware. Evidence: curl 500 + direct Python traceback. Ready to proceed to Phase 2.
