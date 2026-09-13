# 🛠️ Development Guide - VoiceHire

## Quick Start

### 1. Install Dependencies

```bash
# Install pnpm globally if not already installed
npm install -g pnpm@latest

# Install all workspace dependencies
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Then fill in the following in `.env.local`:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/voicehire_db

# Redis
REDIS_URL=redis://localhost:6379

# Agora (get from https://console.agora.io)
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_certificate

# OpenAI
OPENAI_API_KEY=sk-xxx
```

### 3. Setup Database

#### Option A: Local PostgreSQL

```bash
# Install PostgreSQL and pgvector
# macOS:
brew install postgresql postgresql-contrib postgis

# Start PostgreSQL
brew services start postgresql

# Create database
createdb voicehire_db

# Install pgvector extension
psql voicehire_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

#### Option B: Using Docker

```bash
docker run --name postgres-voicehire \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=voicehire_db \
  -p 5432:5432 \
  -d postgres:15

# Install pgvector
docker exec postgres-voicehire psql -U postgres -d voicehire_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

#### Apply Schema

```bash
# Using Prisma
cd packages/database
pnpm db:push

# Or using raw SQL
psql voicehire_db -f databases/schema.sql
```

### 4. Start Development Servers

```bash
# From root directory - starts both frontend and backend
pnpm dev

# Or in separate terminals:

# Terminal 1 - Frontend (http://localhost:3000)
cd apps/web
pnpm dev

# Terminal 2 - Backend (http://localhost:8000)
cd apps/api
python -m uvicorn app.main:app --reload --port 8000
```

## Project Commands

### Root Level (pnpm workspaces)

```bash
# Install all dependencies across workspaces
pnpm install

# Run dev servers for all apps
pnpm dev

# Build all apps
pnpm build

# Run tests across all workspaces
pnpm test

# Format code (prettier, black)
pnpm format

# Lint code
pnpm lint

# Clean build artifacts
pnpm clean
```

### Frontend (`apps/web`)

```bash
cd apps/web

# Development
pnpm dev           # Start Next.js dev server
pnpm build         # Production build
pnpm start         # Run production build
pnpm lint          # Run ESLint
pnpm type-check    # Type checking with TypeScript
```

### Backend (`apps/api`)

```bash
cd apps/api

# Development
python -m uvicorn app.main:app --reload --port 8000

# Or using the scripts in package.json:
pnpm dev           # Start with reload
pnpm start         # Production start
pnpm lint          # Run pylint
pnpm format        # Format with black
pnpm type-check    # Type checking with mypy
```

### Database (`packages/database`)

```bash
cd packages/database

# Apply migrations
pnpm db:push       # Push schema to database

# Generate Prisma client
pnpm db:generate   # Generate type-safe client

# Seed database (when implemented)
pnpm db:seed       # Run seed script
```

## Code Structure

### Backend Routes Organization

```
apps/api/app/routers/
├── health.py       # Health check endpoints (readiness/liveness)
├── agora.py        # Agora token generation & events
├── users.py        # User registration & profile management
├── interviews.py   # Interview session lifecycle
├── evaluations.py  # Reports, analytics, coaching plans
└── __init__.py
```

### Frontend Structure

```
apps/web/
├── app/            # Next.js App Router
│   ├── layout.tsx  # Root layout with Clerk provider
│   ├── page.tsx    # Home page
│   ├── sign-in/    # Clerk sign-in page
│   ├── sign-up/    # Clerk sign-up page
│   ├── dashboard/  # User dashboard
│   ├── interview/  # Interview experience
│   └── globals.css # Tailwind CSS base styles
├── components/     # Reusable React components (to be created)
├── lib/            # Utilities (API clients, helpers)
├── hooks/          # Custom hooks
├── types/          # TypeScript type definitions
└── public/         # Static assets
```

## Testing

### Backend Tests (to be implemented)

```bash
cd apps/api
pytest                    # Run all tests
pytest -v               # Verbose output
pytest tests/test_agora.py  # Specific test file
pytest --cov           # Coverage report
```

### Frontend Tests (to be implemented)

```bash
cd apps/web
npm test              # Jest tests
npm run test:e2e      # Playwright E2E tests
```

## Debugging

### Backend Debugging with VSCode

1. Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["app.main:app", "--reload", "--port", "8000"],
      "jinja": true,
      "cwd": "${workspaceFolder}/apps/api"
    }
  ]
}
```

2. Set breakpoints and press `F5` to start debugging.

### Frontend Debugging

- Use Chrome DevTools (F12)
- Next.js Fast Refresh for instant feedback

### Database Inspection

```bash
# Connect to PostgreSQL
psql voicehire_db

# Useful queries
\dt                    # List all tables
\d interview_sessions  # Describe table structure
SELECT * FROM users;   # Query data
```

## Environment Variables Reference

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk frontend key | `pk_test_xxx` |
| `CLERK_SECRET_KEY` | ✅ | Clerk backend key | `sk_test_xxx` |
| `DATABASE_URL` | ✅ | PostgreSQL connection | `postgresql://user:pass@localhost/voicehire_db` |
| `REDIS_URL` | ✅ | Redis connection | `redis://localhost:6379` |
| `AGORA_APP_ID` | ✅ | Agora app ID | `xxx` |
| `AGORA_APP_CERTIFICATE` | ✅ | Agora certificate | `xxx` |
| `OPENAI_API_KEY` | ✅ | OpenAI API key | `sk-xxx` |
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL | `http://localhost:8000` |
| `PYTHON_ENV` | ⏺️ | Python environment | `development` / `production` |
| `LOG_LEVEL` | ⏺️ | Logging level | `info` / `debug` |

## Common Issues & Solutions

### Issue: `pnpm: command not found`
**Solution**: `npm install -g pnpm@latest`

### Issue: `No module named 'uvicorn'`
**Solution**: `pip install -r apps/api/requirements.txt` or run `pip install -e .` in `apps/api`

### Issue: `DATABASE_URL` not recognized
**Solution**: Ensure `.env.local` is in the root directory and contains `DATABASE_URL=...`

### Issue: Agora token generation fails
**Solution**: Verify `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` are correctly set in `.env.local`

### Issue: Next.js build fails with TypeScript errors
**Solution**: Run `pnpm type-check` to see all errors, fix type issues in source files

## Performance Tips

1. **Database Queries**: Use Prisma's `select()` to only fetch needed fields
2. **API Calls**: Implement request debouncing on the frontend
3. **State Management**: Use Zustand for efficient state updates
4. **Component Rendering**: Use React.memo() for expensive components
5. **Build Size**: Analyze bundles with `next/bundle-analyzer`

## Useful Resources

- [Next.js Docs](https://nextjs.org/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Prisma Docs](https://www.prisma.io/docs)
- [Agora SDK Docs](https://docs.agora.io/en/)
- [Clerk Docs](https://clerk.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

**Happy coding! 🚀**
