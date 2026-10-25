# Quarantine Manifest — feat/cleanup

Files moved here (git mv, history preserved) pending owner review. None are deleted.
To restore: `git mv _quarantine/<path> <original-path>`.
To delete permanently (owner approval required): `git rm _quarantine/<path>` then commit "chore: remove quarantined files".

| Original path | Quarantined path | Reason | Evidence | Date |
|---|---|---|---|---|
| env.example.additions | _quarantine/env.example.additions | Tracked scratch file with zero in-repo references; duplicates .env.example intent | `Select-String "env.example.additions"` over `git ls-files` returned empty | 2026-10-25 |
| docs/setup/DEVELOPMENT.md | _quarantine/docs/setup/DEVELOPMENT.md | Fully redundant with docs/setup/SETUP_GUIDE.md (all commands covered there, no unique content) | Compared both files; DEVELOPMENT.md content is a subset of SETUP_GUIDE.md | 2026-10-25 |
