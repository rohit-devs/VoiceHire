# Local setup

VoiceHire contains a Next.js 15.5 frontend in `apps/web` and a FastAPI backend in `apps/api`. SQLAlchemy models and Alembic migrations own the API schema. The frontend does not use Prisma. Redis is included in the local Compose stack for infrastructure testing, but the API currently does not use it.

## Requirements

- Node.js 20 LTS and Corepack-enabled pnpm 11.24.0
- Python 3.11 or 3.12
- Docker Desktop / Docker Engine with Compose v2 for the container stack (optional for native SQLite development)
- Playwright Chromium for browser tests

## Windows PowerShell: native development

From the repository root:

```powershell
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

Edit `.env` for local SQLite by changing `DATABASE_URL` to:

```text
sqlite+aiosqlite:///./voicehire_local.db
```

Use a fresh local database file for Alembic setup. Existing legacy SQLite files without an Alembic version stamp are not auto-adopted; keep them as-is and use a new filename rather than deleting or reusing them. Keep `APP_ENV=development` and `DEMO_MODE=true` only for local simulated usage. The local demo user is shared and has no Clerk authentication; never use it with real candidate data. Clerk, OpenAI, and Agora values may remain empty for text/demo use.

Create `apps\web\.env.local` with only public web settings and the explicit development/demo flags:

```powershell
@'
APP_ENV=development
DEMO_MODE=true
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_DEMO_MODE=true
'@ | Set-Content apps\web\.env.local
```

If using Clerk locally, add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and server-only `CLERK_SECRET_KEY` to `apps\web\.env.local`, and configure matching Clerk JWKS settings in the root `.env`. Do not commit either file.

Create and install the API virtual environment:

```powershell
py -3.12 -m venv apps\api\.venv
.\apps\api\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e "apps\api[dev]"
pnpm --filter @voicehire/api db:migrate
```

Start both apps together from the repository root:

```powershell
.\apps\api\.venv\Scripts\Activate.ps1
pnpm dev
```

Or start them separately in two terminals:

```powershell
.\apps\api\.venv\Scripts\Activate.ps1
pnpm --filter @voicehire/api dev
```

```powershell
pnpm --filter @voicehire/web dev
```

Open <http://localhost:3000>. The API is on <http://127.0.0.1:8000>. Verify readiness and liveness:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health/ready
Invoke-RestMethod http://127.0.0.1:8000/api/health/live
```

## Linux/macOS: native development

From the repository root:

```sh
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL=sqlite+aiosqlite:///./voicehire_local.db` for SQLite, then create the virtual environment and migrate:

```sh
python3.12 -m venv apps/api/.venv
. apps/api/.venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e 'apps/api[dev]'
pnpm --filter @voicehire/api db:migrate
```

Create `apps/web/.env.local` with the development flags and public API URL:

```sh
printf '%s\n' \
  'APP_ENV=development' \
  'DEMO_MODE=true' \
  'NEXT_PUBLIC_API_URL=http://127.0.0.1:8000' \
  > apps/web/.env.local
```

Run the API and frontend in separate terminals (activate the virtual environment in the API terminal):

```sh
pnpm --filter @voicehire/api dev
```

```sh
pnpm --filter @voicehire/web dev
```

## Complete Docker stack

Docker Compose uses PostgreSQL 16 with pgvector, an idle Redis service, the API, and the web app. Copy `.env.example` to `.env` if you want to override the local-only Compose defaults:

```sh
docker compose up --build
```

The example `.env` explicitly enables the shared local demo account; without it, Compose defaults demo mode off. All published Compose ports bind to `127.0.0.1` and are not exposed to the network. Do not change those settings or use demo mode for a network-accessible deployment. The API container runs `alembic upgrade head` before Uvicorn. PostgreSQL readiness gates the API start; web startup waits for API readiness. Stop the services with `Ctrl+C` and then `docker compose down`. To also remove local database data, explicitly run `docker compose down -v`.

## Tests and quality checks

Activate the API virtual environment, then from the repository root:

```sh
pnpm --filter @voicehire/web type-check
pnpm --filter @voicehire/web lint
pnpm --filter @voicehire/web test
pnpm --filter @voicehire/web exec playwright install chromium
pnpm --filter @voicehire/web test:e2e
pnpm --filter @voicehire/web build
```

Backend tests and migrations:

```sh
python -m pytest apps/api/tests/ -v
pnpm --filter @voicehire/api db:migrate
```

Playwright starts its own API and web servers, uses a fresh temporary SQLite database, and runs in explicit local demo mode. It does not require Clerk, OpenAI, or Agora credentials. The demo interview path intentionally does not create a real evaluation or coaching plan; authenticated real-session evaluation is covered by API tests with a deterministic fake provider.

## Environment and credentials

The root `.env.example` lists API, Compose, and public web build variables. `DATABASE_URL`, `OPENAI_API_KEY`, `AGORA_APP_CERTIFICATE`, `CLERK_SECRET_KEY`, and `CLERK_JWT_JWKS_URL` are server-only. Only `NEXT_PUBLIC_API_URL` and the Clerk publishable key may be exposed to the browser. Never put a server-only key in a `NEXT_PUBLIC_*` variable or commit a populated `.env`.

Deployment settings and platform commands are in [DEPLOYMENT.md](./DEPLOYMENT.md). Schema ownership details are in [docs/database-setup.md](./docs/database-setup.md). Common failures are covered by [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md).
