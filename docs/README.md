# VoiceHire Documentation Index

This directory contains all project documentation, organized by topic.

## docs/setup — Local development & setup

- [SETUP_GUIDE.md](./setup/SETUP_GUIDE.md) — Windows PowerShell and Linux/macOS setup, requirements, native and Compose workflows.
- [DEVELOPMENT.md](./setup/DEVELOPMENT.md) — Development commands and quality checks.

## docs/operations — Deployment & operations

- [DEPLOYMENT.md](./operations/DEPLOYMENT.md) — Vercel web + Railway/Render API deployment, environment variables, release checklist.
- [DEPLOYMENT_CHECKLIST.md](./operations/DEPLOYMENT_CHECKLIST.md) — Pre/post-deployment verification and rollback.
- [TROUBLESHOOTING.md](./operations/TROUBLESHOOTING.md) — Docker, API, Clerk, OpenAI, Agora, Playwright troubleshooting.

## docs/architecture — Architecture & schema

- [VOICE_ARCHITECTURE.md](./architecture/VOICE_ARCHITECTURE.md) — Voice architecture and explicit capability limits.
- [database-setup.md](./architecture/database-setup.md) — Schema ownership (SQLAlchemy + Alembic) and migration workflow.

## docs/product — Product & design

- [DESIGN_SYSTEM.md](./product/DESIGN_SYSTEM.md) — Design tokens, components, accessibility rules, screen requirements.
- [METRICS.md](./product/METRICS.md) — Dashboard metric definitions and data sources.

## docs/cleanup — Repository cleanup (this branch)

- [CLEANUP_STATE.md](./cleanup/CLEANUP_STATE.md) — Phase, baseline, last commit, next action, blockers.
- [CLEANUP_LOG.md](./cleanup/CLEANUP_LOG.md) — Change log for the cleanup pass.
- [INVENTORY.md](./cleanup/INVENTORY.md) — C0 inventory of tracked files, duplicates, orphans, docs, leftovers, secrets scan.
- [PROPOSAL.md](./cleanup/PROPOSAL.md) — C0 proposal: path, action, reason, evidence, risk, reversibility.

## Root-level docs (kept at repo root)

- [README.md](../README.md) — Project pitch, run locally, verification, deployment overview.
- [AGENTS.md](../AGENTS.md) — Agent operating instructions and repository map.
- [HACKATHON_ASSESSMENT.md](../HACKATHON_ASSESSMENT.md) — Hackathon assessment (protected, never touch).
