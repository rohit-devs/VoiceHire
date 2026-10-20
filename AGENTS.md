# AGENTS.md — VoiceHire

> Read this file and `docs/IMPLEMENTATION_CHECKLIST.md` at the start of EVERY session.
> If this file and a prompt conflict, follow the prompt, then tell the user about the conflict.

VoiceHire is an AI voice interview coach: the candidate practises a spoken interview,
gets adaptive follow-up questions, and receives an honest, transparent performance report
with a 7-day coaching plan. Tagline: **Deliberate practice. Honest feedback.**

---

## 1. Prime directives

1. **Never claim what you did not verify.** Report real command output. If you could not
   run something (no keys, no device, no network), say "unverified" and why.
2. **Demo mode must always work with zero credentials.** No change may break it.
3. **Secrets never enter the repo.** Do not read, print, create, or edit `.env`,
   `.env.local`, or any file containing keys. Edit `.env.example` only, with placeholders.
4. **Small, reversible steps.** One file at a time. Commit after each green step.
5. **Honesty over polish.** Never fabricate scores, coaching tasks, transcripts, or
   metrics for real (non-demo) sessions. Demo content is clearly labelled as simulated.
6. **Stop instead of thrashing.** See section 9.

---

## 2. Repository map

```
apps/web/        Next.js 15 (App Router), TypeScript, Tailwind. Package: @voicehire/web
  app/           routes (/, /sign-in, /onboarding, /dashboard, /interview/*, /reports/*)
  components/    ui/primitives.tsx (Button, ButtonLink, Card, Input), interview/*, layout/*
  hooks/         useInterviewWebSocket.ts, useAgoraVoice.ts
  lib/           auth-mode.ts, services/apiInterviewService.ts
  e2e/           Playwright smoke tests
apps/api/        FastAPI (Python 3.11+), SQLAlchemy async, Alembic migrations
  app/           main.py, config.py, database.py, routers/*
  tests/         pytest suite
packages/database/   Prisma schema
packages/prompts/    versioned interviewer + evaluator prompts (YAML/JSON)
docs/                IMPLEMENTATION_CHECKLIST.md, DESIGN_SYSTEM.md
SETUP_GUIDE.md  DEPLOYMENT.md  DEVELOPMENT.md  README.md
```

Do not rename `apps/api/alembic/`. Python imports resolve it incorrectly if the real
`alembic` package is missing from the active environment.

---

## 3. Target stack (free tier, best output)

| Layer | Choice | Notes |
|---|---|---|
| LLM | Groq via OpenAI-compatible API | Swap `base_url` and key. Fast model for live turns, stronger model for reports. Model names come from env. |
| STT | Deepgram streaming (backend) | Browser mic audio goes over WebSocket to the API, which streams to Deepgram. Fallback: browser Web Speech API. |
| TTS | Browser `speechSynthesis` | Voice selection, rate control, cancel on interruption. |
| RTC | Agora, **optional** | The interview must work without Agora credentials. |
| Auth | Clerk | Local no-Clerk demo sign-in stays supported. |
| DB | SQLite locally, PostgreSQL when deployed | Via `DATABASE_URL`. Hosted free hosts may not persist SQLite files. |
| Hosting | Vercel (web) + a public host for the API | A Vercel site cannot reach a laptop's `127.0.0.1`. |

Free-tier limits change. Never hardcode quota assumptions. Verify on each provider's
pricing page before relying on them.

### Provider rules
- All providers sit behind an abstraction in `apps/api`: one implementation per provider
  plus one demo/mock implementation. Select by env vars. Never hardcode a provider.
- `/api/health/ready` must report each provider truthfully: `ok`, `disabled`, or `error`.
- Handle 429 and quota errors: retry once with backoff, then show a clear message and
  offer the text-input fallback or demo mode. Never crash the interview.
- Every report states which provider and model produced it.

---

## 4. Environment

- Shell is **Windows PowerShell**. Use PowerShell syntax (`$env:NAME='value'`, `;` not `&&`).
- Python: use ONE venv at `apps/api/.venv` and run the API with that interpreter. The
  root `.venv` lacks the API dependencies and causes `ImportError: cannot import name
  'command' from 'alembic'`.
- Demo flags: `APP_ENV=development`, `DEMO_MODE=true`, `NEXT_PUBLIC_DEMO_MODE=true`.
- Browser API calls use relative `/api/*`. Next rewrites to `API_INTERNAL_URL`. Leave
  `NEXT_PUBLIC_API_URL` blank by default, otherwise LAN browsers call their own loopback.
- WebSocket URL derives `ws:`/`wss:` from `window.location` unless explicitly set.
- LAN dev: set `DEV_ALLOWED_ORIGINS` to the LAN IP. Mic needs HTTPS or localhost; show
  "Microphone needs HTTPS or localhost" with the text fallback on insecure contexts.
- Ports: web 3000, API 8000. Playwright uses isolated servers on other ports.

---

## 5. Commands (run from repo root)

```powershell
pnpm install --frozen-lockfile
pnpm --filter @voicehire/web type-check
pnpm --filter @voicehire/web lint
pnpm --filter @voicehire/web test                      # Vitest
pnpm --filter @voicehire/web build
pnpm --filter @voicehire/web test:e2e -- --workers=1   # Playwright
apps\api\.venv\Scripts\python.exe -m pytest apps\api\tests -q
pnpm dev                                               # web + API
```

Baseline at last verification: type-check, lint, build (18 routes), 8 Vitest tests,
45 pytest tests, 4 Playwright tests all passing. Do not leave the repo worse than this.

**Definition of done** for any task: type-check, lint, test, build, pytest (if API
touched), and Playwright all pass, `git diff --check` is clean, the worktree is clean,
and the checklist is updated.

---

## 6. Editing rules (these prevent the JSX breakage seen before)

1. **One file at a time.** Run `type-check` after every edit. Do not stack edits on a
   failing file.
2. **Never change a closing tag without changing its opening tag in the same edit.**
   When wrapping or unwrapping elements (`div` ↔ `Card`), edit both tags together.
3. **Prefer small `str_replace` edits over rewriting whole files.** Do not rewrite files
   that are already done.
4. **If an edit breaks the build**, undo that edit (or `git restore --source=HEAD -- <file>`)
   and redo it more carefully. Do not patch blind.
5. **No new dependencies without asking.** Prefer existing primitives and utilities.
6. **Do not touch backend contracts** during UI work.
7. **Do not commit** generated files: `apps/web/test-results/`, `.playwright-mcp/`,
   `apps/web/.next-playwright/`, screenshots outside `docs/screenshots/`. After test
   runs, restore `apps/web/next-env.d.ts` if it changed.
8. **Do not create empty commits** for work already committed.

---

## 7. Git workflow

- Branch: `feat/finish-voicehire` (never commit directly to the default branch).
- Commit after each green step. Conventional messages: `feat:`, `fix:`, `docs:`, `chore:`,
  `test:`. Keep each commit to one concern.
- Before committing: `git status --short`, `git diff --check`. Confirm no `.env*` file
  is staged (only `.env.example`).
- Push only when asked. Never force-push. Never rewrite history.
- If line endings cause large diffs, add `.gitattributes` with `* text=auto eol=lf`.

---

## 8. Design system

Full spec lives in `docs/DESIGN_SYSTEM.md`. If a section is missing there (buttons, cards,
inputs, spacing, focus, motion, voice-orb states), extend the doc first, commit it, then
build to it.

**Feel:** dark, focused, high-contrast, serious practice. No decorative gradients.

| Token | Hex | Use |
|---|---|---|
| `--bg-base` | `#0a0a0a` | page background |
| `--bg-elevated` | `#0d0d0d` | cards, modals |
| `--bg-input` | `#141414` | inputs, selects, textareas |
| `--border` | `#262626` | default borders |
| `--accent` | `#e8321e` | primary CTAs, key metrics, brand moments |
| `--accent-hover` | `#ff3b2d` | primary hover |
| `--text-primary` | `#e5e5e5` | body text |
| `--text-secondary` | `#a3a3a3` | secondary text |
| `--text-muted` | `#737373` | helper text |
| `--success` / `--error` / `--warning` | `#34d399` / `#f87171` / `#fbbf24` | status |

Rules:
- Never use pure white (`#ffffff`) for large text areas.
- Accent red is reserved for primary CTAs, key metrics, and brand moments.
- Borders stay subtle unless interactive; interactive hover border uses the accent.
- Display font (Impact stack, uppercase, tight leading) for headlines only.
  Label style (0.28em tracking, uppercase, 12px, bold) for small labels.
  Body uses the system UI font stack.
- Define tokens as CSS variables in `globals.css` and map them in Tailwind. Use shared
  primitives in `components/ui/primitives.tsx` everywhere, not one-off styles.
- Accessibility is required: visible focus states, AA contrast, labelled inputs,
  `aria-live` on the live transcript, keyboard-reachable controls.
- Verify layouts at **375, 768 and 1440 px**. Store screenshots in `docs/screenshots/`.

Screen requirements:
- **Landing:** one value proposition, one primary CTA ("Try demo interview"), short
  how-it-works.
- **Interview live:** obvious VoiceOrb states (AI speaking / listening / idle), live
  auto-scrolling transcript, readable metrics on mobile, visible text-input fallback.
- **Report:** score summary, strengths, weaknesses, 7-day coaching plan, retry button.
  Empty plan days are labelled empty for real sessions; demo sessions show a clearly
  labelled simulated plan.
- **Demo banner:** visible, not intrusive.

---

## 9. Stop conditions

Stop, summarise, and ask the user when:
- the same command fails twice after a fix attempt;
- a tool call fails with a network error twice;
- type-check or lint fails and you are about to edit a third file to fix it;
- the diff grows beyond the files the task needs (e.g. 100+ unexpected files);
- a task needs a secret, paid service, deployment, or force-push;
- repo state differs from what you expected (unknown commits, missing files).

Do not ask for permission on routine, reversible steps already covered by this file.

---

## 10. Testing expectations

- Every behaviour change gets a test: Vitest for hooks/lib, pytest for API (providers
  mocked), Playwright for user journeys.
- Required Playwright journeys: no-Clerk demo sign-in, onboarding, simulated interview
  to report, insecure-context mic fallback, provider-failure fallback.
- Playwright runs with `--workers=1`. Wait for redirects (`router.replace`) before
  navigating elsewhere; do not add arbitrary sleeps.
- Never weaken or delete a test to make it pass. Fix the cause or report it.

---

## 11. Security and privacy

- Keys live in `.env.local` (local), Vercel env vars (web), and the API host's variables.
- Never log keys, tokens, transcripts, or resume text in plain output.
- Demo data is simulated and labelled; users are told not to enter real candidate data
  in demo mode.
- Keep dependencies patched. Do not downgrade to silence an advisory.
- CORS origins come from env, never `*` in production.

---

## 12. Final report format

End every task with this, using real output:

```
## Done
- <what changed, with file names>

## Verified (real output)
- type-check: pass/fail
- lint: pass/fail
- vitest: N passed
- pytest: N passed
- build: pass/fail (N routes)
- playwright: N passed
- git diff --check: clean/not clean
- worktree: clean/not clean
- commits: <hashes + messages>

## Unverified
- <anything not run and why: live Clerk/Groq/Deepgram/Agora, LAN device, CI, deploy>

## Next
- <one recommended next step>
```

---

## 13. Roadmap (do in order, one phase per session)

1. **Free-tier provider layer** — LLM/STT abstraction, Groq + Deepgram, browser TTS,
   optional Agora, truthful health checks, quota handling, tests.
2. **Design system rollout** — tokens, primitives, all screens, before/after screenshots.
3. **Real-key verification** — user supplies keys in `.env.local`; run one full voice
   interview; record latency and errors in the checklist. Test mic on HTTPS.
4. **README rewrite** — pitch, screenshots, 3-command demo quickstart, env table
   (required vs optional), architecture, test commands, roadmap, licence.
5. **CI green** — `.github/workflows/ci.yml` runs install, type-check, lint, test, build,
   pytest, Playwright in demo mode.
6. **PR and merge** into the default branch.
7. **Deploy** — web on Vercel, API on a public host with PostgreSQL, demo mode first.
8. **Final check** on a phone against the live URL.

Update `docs/IMPLEMENTATION_CHECKLIST.md` at the end of each phase with what was done,
what was verified, and what remains.