---
# lasso-43p7
title: Replace raw SQLite and Sentry scaffold
status: completed
type: task
priority: normal
created_at: 2026-04-24T13:32:08Z
updated_at: 2026-04-24T13:36:24Z
---

Evaluate and clean up persistence/logging scaffolds: use Drizzle with bun:sqlite where appropriate and remove unused Sentry logging.

## Summary of Changes\n- Added Drizzle schema for lint tables\n- Rewrote lint observer repository to use Drizzle query builder and prepared selects\n- Replaced deprecated bun:sqlite exec calls with run-based migration statements\n- Removed @sentry/bun dependency and replaced Sentry logger scaffold with stderr logger\n- Verified format, lint, and full test suite pass
