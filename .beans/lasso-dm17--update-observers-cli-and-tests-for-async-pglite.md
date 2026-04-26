---
# lasso-dm17
title: Update observers, CLI, and tests for async PGlite
status: completed
type: task
priority: high
created_at: 2026-04-25T21:31:29Z
updated_at: 2026-04-25T22:07:32Z
parent: lasso-a2px
---

Update runtime code and test fixtures for async PGlite-backed persistence.

- [ ] Update lint observer DB access
- [ ] Update memory and working-memory DB access
- [ ] Update CLI and TUI callers for async persistence
- [ ] Update unit/integration tests
- [ ] Run format, lint, tests, and tsc



## Summary

Converted all observer/CLI/TUI code from sync to async. Added date normalization layer for timestamp columns (PGlite returns `2025-04-25 00:00:00+00` for date-only strings). Updated CLI to use `await getDb()`, `await runMigrations()`, and `program.parseAsync()`. Increased CLI integration test timeouts to 30s for WASM cold start. Added `tests/helpers/db.ts` with shared in-memory PGlite instance and TRUNCATE-based isolation. All 76 tests pass.
