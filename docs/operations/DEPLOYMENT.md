# Deployment guide

This guide describes a deployment procedure; it is not evidence that VoiceHire has been deployed. No production URL is claimed. Validate each provider and the end-to-end journey in a staging environment before announcing availability.

## Architecture and secrets

- Deploy `apps/web` to Vercel as a Next.js project.
- Deploy `apps/api` to Railway or Render from the repository-root Docker build context using `apps/api/Dockerfile`.
- Use managed PostgreSQL with pgvector. The API applies `alembic upgrade head` before startup.
- Redis is present in Docker Compose but is not consumed by API code; it is not a production dependency today.
- Store secrets only in the API platform's secret store. The web needs the public API URL and Clerk publishable key. Never put `OPENAI_API_KEY`, `AGORA_APP_CERTIFICATE`, or `CLERK_SECRET_KEY` in `NEXT_PUBLIC_*` variables, Vercel web variables, or a client bundle.
- Set `DEMO_MODE=false` and `APP_ENV=production`. The shared local demo-user bypass is restricted to development without Clerk configuration.

## API on Railway or Render

1. Provision a PostgreSQL database with the pgvector extension supported. Create an API service from the `rohit-devs/VoiceHire` repository.
2. Set the Dockerfile path to `apps/api/Dockerfile`; the Docker build context must be the repository root so `packages/prompts` is available.
3. Add required API variables:
   - `APP_ENV=production`
   - `DEMO_MODE=false`
   - `DATABASE_URL` — managed PostgreSQL URL; use a URL-encoded password and the provider's TLS parameters.
   - `CORS_ORIGINS` — exact HTTPS Vercel origin(s), comma-separated; no wildcard when credentials are enabled.
   - `ALLOWED_HOSTS` — API service hostname plus provider-required health-check hostnames.
   - `CLERK_SECRET_KEY` and `CLERK_JWT_JWKS_URL` — server-only Clerk credentials/JWKS endpoint.
4. Optional provider variables:
   - `OPENAI_API_KEY` and `OPENAI_MODEL` for real question generation and report assessments.
   - `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE`, and `AGORA_TOKEN_EXPIRATION` (maximum 3600 seconds) for RTC token signing.
   - `EVALUATION_RUBRIC_WEIGHTS` only when intentionally overriding all evaluator rubric category weights.
5. Configure health checks to `GET /api/health/ready`. `/api/health/live` is a liveness-only check. The Dockerfile runs `alembic upgrade head` before the API starts; use one migration-capable API instance at first, and take a database backup before applying production migrations.
6. Verify `/api/health/ready`, `/api/health/live`, an authenticated profile update, session ownership, and report persistence from the deployed web origin.

`/api/health/ready` verifies database connectivity. Optional provider states indicate whether required configuration is present, not a live remote API health probe. Redis is reported disabled because the API does not use it.

## Web on Vercel

1. Import the monorepo into Vercel and set the project root to `apps/web`. Use the Next.js framework preset and Node.js 20.
2. Configure the workspace-aware install/build commands if auto-detection does not select them:

   ```sh
   pnpm install --frozen-lockfile
   pnpm --filter @voicehire/web build
   ```

3. Set these web variables for production builds:
   - `NEXT_PUBLIC_API_URL=https://<your-api-host>` — public API origin; required.
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...` — public Clerk key; required for Clerk sign-in.
   - `CLERK_SECRET_KEY` — server-only middleware key; required by middleware at runtime. Configure it as a server environment variable, not a `NEXT_PUBLIC_*` variable.
   - `APP_ENV=production` and `DEMO_MODE=false` — ensure no local demo bypass is enabled.
4. In Clerk, set production domains and redirect URLs to the Vercel host. Configure sign-in path `/sign-in`, sign-up path `/sign-up`, post-sign-in `/dashboard`, and post-sign-up `/onboarding`. Set the matching issuer/JWKS endpoint in the API service.
5. In API `CORS_ORIGINS`, allow only the production Vercel origin and any intentionally used custom domain. Confirm `ALLOWED_HOSTS` includes the API hostname.
6. Deploy web and API, then verify authenticated onboarding, profile persistence, an interview session, report retrieval, and coaching progress. Do not enable demo mode to bypass a failed Clerk setup.

## Environment variable inventory

The maintained variable template is [`.env.example`](./../../.env.example). Public variables are limited to `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. `DATABASE_URL`, `OPENAI_API_KEY`, `AGORA_APP_CERTIFICATE`, `CLERK_SECRET_KEY`, and `CLERK_JWT_JWKS_URL` are server-only. `POSTGRES_PASSWORD` is a local Compose setting; use managed database credentials in deployment. See the template comments for all optional values.

## Release checklist and troubleshooting

Use [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) as the release gate and [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common provider, migration, and browser issues.
