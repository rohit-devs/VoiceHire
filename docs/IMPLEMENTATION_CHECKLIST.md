# Implementation Checklist

## Done

- Created and switched to the requested `feat/finish-voicehire` branch without discarding the existing worktree edits.
- Reviewed the auth persistence path and fixed it so a failed user upsert returns an explicit service-unavailable error instead of treating an unpersisted identity as authenticated.
- Added a regression test for database write failures.
- Declared `aiosqlite==0.19.0`: the configured default and test database URLs use `sqlite+aiosqlite`, but the backend manifest did not include its driver.
- Manually exercised the auth persistence failure path with an async mock; it raised 503, rolled back, and did not return a user.
- Frontend TypeScript check passed: `pnpm type-check` from `apps/web`.
- `git diff --check` passed.

## Blocked

- API tests are blocked because the project virtual environment has no `pytest`, and system Python is missing the declared `pytest-asyncio` test dependency. Installing the test dependency also failed because `files.pythonhosted.org` timed out; the newly declared SQLite driver is not installed in the current environment either.

## Remaining

- Install the backend's declared runtime and test dependencies when package-index access is available, then rerun API tests.
- Keep the pre-existing, unrelated worktree edits separate from the auth fix and its regression test.
