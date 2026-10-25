# VOICEHIRE_LOG.md

Timestamped, append-only session log. Repo: C:\VoiceHire, branch feat/remove-auth.

## 2026-10-24 — Phase 1 Audit & Phase 2 stabilization

### Phase 1 — Audit (read-only except VOICEHIRE_AUDIT.md)
- Branch: feat/remove-auth (last commit 5f3f378). Pre-existing untracked: .kilo/, HACKATHON_ASSESSMENT.md, apps/hackathon/ — left untouched.
- Servers running pre-existing: API 127.0.0.1:8000 (demo mode), Web 127.0.0.1:3000.
- .env/.env.local are git-ignored; contents not read (secrets radioactive). Config values observed only via running app: LLM_PROVIDER=ollama, DEMO_MODE=true, no GROQ/DEEPGRAM/AGORA keys.
- Baselines recorded: pytest 65 passed; type-check pass; lint pass; vitest 10 passed; build pass (16 routes). (AGENTS.md baselines of 45 pytest / 8 vitest / 18 routes are stale.)

### Phase 1 — Confirmed root cause of "Failed to fetch" (GATE 1 PASSED)
- Failing request: POST /api/evaluations/sessions/{id}/report/generate → HTTP 500 (text/plain "Internal Server Error"). GET /api/interviews/sessions/{id} → 200 OK.
- Root cause: unhandled TypeError "can't subtract offset-naive and offset-aware datetimes" at app/interview/voice_metrics.py:74. measured_evidence passes naive session.ended_at as `now`; calculate_voice_metrics normalizes started_at to UTC-aware; naive - aware crashes. This 500 is not a ProviderError/HTTPException, so it bypasses the except clauses in routers/evaluations.py. Frontend request() can't parse the text/plain 500 as JSON and throws, surfacing "Interview saved" + error together.
- Evidence: curl -i → HTTP 500; direct Python repro via generate_assessment against real SQLite DB printed the full traceback ending at voice_metrics.py:74.
- Provider reality: Ollama WORKING (127.0.0.1:11434, llama3.2:1b installed, LLM_PROVIDER=ollama). Groq/Deepgram/Agora ABSENT (no keys/credentials). STT backend = BrowserSTT only (client Web Speech); Deepgram provider exists but unconfigured.
- Doc: VOICEHIRE_AUDIT.md (10 numbered issues P0-P3 with fix order).

### Phase 2 — Fix + regression test (GATE 2 PASSED)
- fix(api): voice_metrics.py normalizes `current_time` to UTC when offset-naive, so both operands of `current_time - normalized_start` are aware. Committed 82121d8.
- Regression test added: tests/test_voice_metrics.py::test_naive_sqlite_timestamps_do_not_crash — FAILS before fix (TypeError at voice_metrics.py:74), PASSES after. Full API suite 66 passed (65 baseline + 1 new), no regressions.
- Scripted run proved create session → start → add transcript → end (completed) → generate-evaluation (HTTP 200, was 500) → report persists → restart API backend → report reloads from DB (HTTP 200, identical data). Note: Ollama llama3.2:1b cannot satisfy the strict evaluation schema, so the endpoint gracefully returns status:"failed" with a clear error — honest, no crash, no fake data.
- fix(web): InterviewCompletePage split into explicit loading/success/error states. "Interview saved" only renders after generateEvaluation resolves successfully (View report button). Error state shows the message with Try-again + Return to dashboard. Committed 551c3a6. Frontend type-check pass, lint pass.
- Remaining Phase 2 items (not blocking the hard gate): A-3 base-URL/LAN consistency, A-4 typed API client timeout/abort/retry, A-10 guest-identity cookie-vs-header consistency. To be addressed before/alongside later phases if in scope.

### 2026-10-25 — Phase 2 client-side reliability (A-3, A-4, A-10)
- A-3 base-URL/LAN consistency: satisfied by design — `NEXT_PUBLIC_API_URL` blank, all requests relative same-origin (`/api/*`), Next.js rewrite proxies server-side to `http://127.0.0.1:8000/api/*`. Browser never needs the API host/IP; works identically on localhost, 127.0.0.1, or LAN.
- fix(web): typed API client with timeout/abort/retry (committed 53b3057).
- fix(api): X-Guest-Id header authoritative over Secure cookie (committed 3297c55).
- fix(web): Idempotency-Key headers on all mutating POST calls (committed cf1bc26), matching backend IdempotencyRecord dedup. Stable keys per (session, operation, message).
- vitest: 18 passed (15 baseline + 3 new); type-check pass; lint pass; build: pass (16 routes).

### Verified (real output, current)
- pytest: 66 passed
- type-check: pass
- lint: pass
- vitest: 18 passed
- build: pass (16 routes)
- git diff --check: clean
- worktree: clean (pre-existing untracked only)
