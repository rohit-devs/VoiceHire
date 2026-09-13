# AGENTS.md

## Project Overview
VoiceHire — real-time AI interview performance engine. Monorepo with:
- `apps/api` — Python/FastAPI backend (SQLite locally, PostgreSQL in prod)
- `apps/web` — Next.js frontend with Clerk auth, Agora voice
- `packages/` — shared database schema and prompts

## Common Commands

### Backend (Python / FastAPI)
From `apps/api`:
```bash
# Activate venv
.venv\Scripts\Activate.ps1

# Run tests
python -m pytest tests/ -v

# Run dev server
uvicorn app.main:app --reload

# Type check
python -m mypy app/

# Lint
python -m pylint app/
```

### Frontend (TypeScript / Next.js)
From `apps/web`:
```bash
# Type check
pnpm type-check

# Lint
pnpm lint
```

## Key Conventions
- Backend uses SQLAlchemy Core (raw SQL via `text()`), not ORM models
- Backend routes use `Depends(get_current_user)` for auth
- Session ownership is verified via `_verify_session_ownership()` helper
- Frontend uses `apiInterviewService` singleton; auth token set via `setAuthToken()` from `@/lib/services`
- `ClerkTokenSync` component in `app/layout.tsx` syncs Clerk JWT to the service
- Tests live in `apps/api/tests/`
- SQLite is used for local testing (no Docker required)
