# Local setup

VoiceHire contains a Next.js 15.5 frontend in `apps/web` and a FastAPI backend in `apps/api`. SQLAlchemy models and Alembic migrations own the API schema. The frontend does not use Prisma. Redis is included in the local Compose stack for infrastructure testing, but the API currently does not use it.

## Requirements

- Node.js 20 LTS and Corepack-enabled pnpm 11.24.0
- Python 3.11 or 3.12
- Docker Desktop / Docker Engine with Compose v2 for the container stack (optional for native SQLite development)
- Playwright Chromium for browser tests

## Windows PowerShell: native development

### Environment reproducibility (FastAPI/Starlette pin)

`apps/api/pyproject.toml` pins `fastapi==0.121.3` and `starlette==0.49.1`. This pair is verified compatible on Python 3.12: Starlette 0.49.x removed `on_startup` from `Router.__init__`, and FastAPI 0.121.3 works with it. Do not loosen or unpin these versions; a fresh global Python 3.12 install without the exact pins can fail pytest collection with `Router.__init__() got an unexpected keyword argument 'on_startup'`.

### Windows Application Control: .exe launcher restriction

Windows Application Control blocks `.exe` launchers in `apps/api/.venv`. Never run `pytest.exe`, `pip.exe`, or `uvicorn.exe` directly. Always use module form with the venv's `python`:

```powershell
apps\api\.venv\Scripts\python.exe -m pip install -e ".[dev]"
apps\api\.venv\Scripts\python.exe -m pytest tests -q
apps\api\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Do not recreate the venv; reinstall into the existing `apps/api/.venv` if packages are missing.

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

Use a fresh local database file for Alembic setup. Existing legacy SQLite files without an Alembic version stamp are not auto-adopted; keep them as-is and use a new filename rather than deleting or reusing them. Keep `APP_ENV=development` and `DEMO_MODE=true` only for local simulated usage. The local demo user is shared and has no Clerk authentication; never use it with real candidate data. Groq, Deepgram, Clerk, and Agora values may remain empty for the zero-credential demo.

## Optional free-tier provider keys

The simulated demo runs without any provider keys. Add real provider keys only to the
API host's environment or an untracked local `.env`; never add them to a `NEXT_PUBLIC_*`
variable or commit a populated environment file.

### Groq (interviewer and evaluation LLM)

1. Create an account at <https://console.groq.com/>.
2. Create an API key in the Groq console's API Keys page:
   <https://console.groq.com/keys>.
3. Set `GROQ_API_KEY` in the API environment. `GROQ_BASE_URL`,
   `GROQ_FAST_MODEL`, and `GROQ_STRONG_MODEL` are configurable there as well.

The fast model is used for interviewer turns; the stronger model is used for reports.
Groq model availability and free-tier limits can change; check the console before
choosing or changing a model.

### Deepgram (streaming speech recognition)

1. Create an account at <https://console.deepgram.com/>.
2. Create an API key in the console's API Keys section.
3. Set `DEEPGRAM_API_KEY` in the API environment. The default
   `DEEPGRAM_MODEL=nova-3` can be overridden there.

The key stays server-side: browser audio is forwarded to the API, which connects to
Deepgram. When the key is absent or streaming is unavailable, the browser uses Web
Speech recognition when supported, with typed answers always available. Confirm the
current free usage and model availability in the Deepgram console.

### Clerk (optional for local demo, required for authenticated accounts)

Create a Clerk application at <https://dashboard.clerk.com/>. Configure the web
publishable key in `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and the server secret/JWKS
settings in the web/API environments as described in the Clerk dashboard. Keep the
secret key and JWKS URL server-only. Without Clerk keys, use the local simulated demo.

### Agora (optional RTC transport)

If using Agora RTC, create an app in the Agora console at <https://console.agora.io/>
and set its App ID and App Certificate on the API and web environments as documented
there. Agora is optional; browser speech and text interview paths do not require it.

Create `apps\web\.env.local` with the explicit development/demo flags and the server-side URL used by the Next.js API proxy. Leave `NEXT_PUBLIC_API_URL` unset so browser requests use same-origin relative `/api` URLs:

```powershell
@'
APP_ENV=development
DEMO_MODE=true
API_INTERNAL_URL=http://127.0.0.1:8000
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

## Access from another device on your LAN

The same-origin `/api/*` rewrite forwards browser requests from the Next.js server to `API_INTERNAL_URL`; do not set `NEXT_PUBLIC_API_URL` to `127.0.0.1`, because that address would refer to the browser's own device. On the development computer, activate the API virtual environment and start both apps from the repository root:

```powershell
.\apps\api\.venv\Scripts\Activate.ps1
pnpm dev:lan
```

Find the development computer's private IPv4 address with `ipconfig`, set `DEV_ALLOWED_ORIGINS=<LAN-IP>` in `apps\web\.env.local` (comma-separated host names/IPs without a scheme), and restart Next.js. Then open `http://<LAN-IP>:3000` from a device on the same network. Keep `API_INTERNAL_URL=http://127.0.0.1:8000` on the development computer: the Next.js proxy reaches the API locally, while the browser stays on the web origin. If you intentionally call the API directly from another device, set the API's `CORS_ORIGINS` to the exact web origin(s), including the LAN IP, and expose port 8000 only when needed.

If Windows Firewall blocks access, add an inbound rule for the web server on the **Private** profile from an elevated PowerShell prompt:

```powershell
New-NetFirewallRule -DisplayName "VoiceHire Next.js dev (Private)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Private
```

For direct API access only, add port 8000 separately and restrict it to the Private profile:

```powershell
New-NetFirewallRule -DisplayName "VoiceHire API dev (Private)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -Profile Private
```

Microphone access requires a secure browser context. `http://localhost` works for local testing; an HTTP LAN IP does not. For LAN voice testing, use Next.js's development HTTPS certificate:

```powershell
pnpm --filter @voicehire/web exec next dev --hostname 0.0.0.0 --experimental-https
```

Run the API separately with `pnpm --filter @voicehire/api dev:lan`. Alternatively, use a trusted HTTPS development tunnel that forwards to port 3000. Tunnels may make your development app reachable outside the LAN: use demo data only and do not expose credentials or real candidate data. The text-answer fallback remains available without HTTPS.

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

Create `apps/web/.env.local` with the development flags and server-side proxy target:

```sh
printf '%s\n' \
  'APP_ENV=development' \
  'DEMO_MODE=true' \
  'API_INTERNAL_URL=http://127.0.0.1:8000' \
  > apps/web/.env.local
```

Run the API and frontend in separate terminals (activate the virtual environment in the API terminal):

```sh
pnpm --filter @voicehire/api dev
```

```sh
pnpm --filter @voicehire/web dev
```

For LAN access, activate the API virtual environment and run `pnpm dev:lan` from the repository root. Open `http://<LAN-IP>:3000` from a device on the same network. Allow inbound TCP port 3000 in the host firewall on its private-network profile; port 8000 is only needed for direct API access. For microphone access from the LAN, use a trusted HTTPS tunnel or run `pnpm --filter @voicehire/web exec next dev --hostname 0.0.0.0 --experimental-https` and run the API separately with `pnpm --filter @voicehire/api dev:lan`. Never use real candidate data through a public tunnel.

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

Playwright starts its own API and web servers, uses a fresh temporary SQLite database, and runs in explicit local demo mode. It does not require Clerk, Groq, Deepgram, or Agora credentials. The demo interview path intentionally does not create a real evaluation or coaching plan; authenticated real-session evaluation is covered by API tests with a deterministic fake provider.

## Environment and credentials

The root `.env.example` lists API, Compose, and public web build variables. `DATABASE_URL`, `API_INTERNAL_URL`, `GROQ_API_KEY`, `DEEPGRAM_API_KEY`, `AGORA_APP_CERTIFICATE`, `CLERK_SECRET_KEY`, and `CLERK_JWT_JWKS_URL` are server-only. The browser uses relative API URLs by default; only the optional `NEXT_PUBLIC_API_URL` override and Clerk publishable key may be exposed to the browser. Never put a server-only key in a `NEXT_PUBLIC_*` variable or commit a populated `.env`.

Deployment settings and platform commands are in [DEPLOYMENT.md](./../operations/DEPLOYMENT.md). Schema ownership details are in [docs/database-setup.md](./../architecture/database-setup.md). Common failures are covered by [docs/TROUBLESHOOTING.md](./../operations/TROUBLESHOOTING.md).

## Consolidation

The development-command quick reference formerly in `DEVELOPMENT.md` has been consolidated into this setup guide. All `pnpm`, `pip`, `pytest`, and Docker Compose workflows above are authoritative; `DEVELOPMENT.md` is retained in `_quarantine/` as a historical pointer.
