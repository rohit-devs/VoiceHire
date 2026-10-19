# Deployment checklist

## Before deployment

- [ ] Run `pnpm install --frozen-lockfile`.
- [ ] Run frontend type-check, lint, unit tests, production build, and Playwright E2E.
- [ ] Run `python -m pytest apps/api/tests/ -v`.
- [ ] Run `alembic upgrade head` against a disposable database of the same engine/major version as production.
- [ ] Back up the production database and confirm a restore procedure.
- [ ] Set `APP_ENV=production` and `DEMO_MODE=false` for both services.
- [ ] Configure production PostgreSQL with pgvector; confirm the API database account has only required privileges.
- [ ] Store API and Clerk secrets in the platform secret manager. Do not include server-only values in web build variables or a `NEXT_PUBLIC_*` variable.
- [ ] Configure `NEXT_PUBLIC_API_URL`, Clerk publishable key, Clerk secret key, and issuer/JWKS URL for the intended production domains.
- [ ] Set API `CORS_ORIGINS` to exact production web origins and `ALLOWED_HOSTS` to actual API/health-check hostnames.
- [ ] Configure OpenAI/Agora credentials only when those integrations are enabled and have been manually verified.
- [ ] Keep Redis disabled as an application dependency until runtime code and its outage behavior are implemented.
- [ ] Configure `/api/health/ready` for readiness and `/api/health/live` for liveness.

## After deployment

- [ ] Confirm the readiness endpoint reports database status `ok`, contains no credentials, and optional service states match configuration.
- [ ] Confirm the API root, web landing page, Clerk sign-in, sign-up, and onboarding.
- [ ] Create a real session with test data, submit answers, end it, generate/reload a report, and update/reload coaching progress.
- [ ] Confirm a second user receives `403` for another user's session, report, and coaching plan.
- [ ] Confirm simulated sessions remain labeled and excluded from real evaluations and reports.
- [ ] Confirm text fallback is explicit when Agora is missing or unavailable.
- [ ] Inspect the built web bundle and browser network responses for server-only key exposure.
- [ ] Review service logs for startup/migration errors; verify logs contain no candidate text or credentials.
- [ ] Record the deployed URL, commit SHA, migration revision, and actual smoke-test evidence before claiming a production release.

## Rollback

- [ ] Disable or roll back the web/API release using the platform's supported rollback mechanism.
- [ ] Restore the database only from a verified backup when data or migration integrity requires it.
- [ ] Do not use `alembic downgrade` against production without a reviewed, data-preserving rollback plan.
