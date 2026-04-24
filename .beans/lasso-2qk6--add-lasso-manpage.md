---
# lasso-2qk6
title: Add lasso manpage
status: completed
type: task
priority: normal
created_at: 2026-04-24T20:30:04Z
updated_at: 2026-04-24T20:30:50Z
---

Add a focused manpage documenting install, setup, path resolution, and core commands.

- [x] Add manpage source
- [x] Include manpage in package metadata
- [x] Add package test coverage
- [x] Run formatter, lint, tests, and TypeScript check

## Summary of Changes

Added man/lasso.1 covering purpose, install options, setup, LASSO_PATH and ancestor path resolution, core commands, environment, and files. Registered the manpage in package.json via the man field and included the man directory in packaged files. Updated package metadata tests and verified the packed tarball includes man/lasso.1.

Validation: bun run format; bun run lint; bun test; bunx tsc --noEmit; bun pm pack --dry-run.
