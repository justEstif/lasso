---
# lasso-m903
title: Resolve lasso project path from env or ancestors
status: completed
type: feature
priority: normal
created_at: 2026-04-24T20:28:00Z
updated_at: 2026-04-24T20:29:27Z
---

Support LASSO_PATH and parent-directory discovery for project-local config/db.

- [x] Inspect current path assumptions and tests
- [x] Implement project root resolution
- [x] Add unit/integration tests
- [x] Run formatter, lint, tests, and TypeScript check

## Summary of Changes

Added shared lasso path resolution that honors LASSO_PATH, supports both project-root and direct .lasso directory values, and walks upward to find the nearest .lasso/config.json. Wired config loading, observer toggles, database access, and setup through the resolver. Documented the behavior in README.md and added tests for path resolution and subdirectory database reuse.

Validation: bun run format; bun run lint; bun test; bunx tsc --noEmit.
