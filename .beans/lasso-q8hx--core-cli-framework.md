---
# lasso-q8hx
title: Core CLI Framework
status: completed
type: epic
priority: normal
created_at: 2026-04-24T11:29:31Z
updated_at: 2026-04-24T18:12:46Z
parent: lasso-r2l5
---

Build the harness-agnostic CLI framework including config loading, observer registry, SQLite persistence, and command dispatch.

## Summary of Changes\n- Completed the core CLI framework for the MVP\n- Added Bun/Commander CLI scaffolding and config loading\n- Added project/global config merge behavior and observer enable/disable mutation\n- Added SQLite persistence with WAL mode\n- Adopted Drizzle schema, generated migrations, and runtime migration application\n- Added formatting, linting, and test infrastructure\n\n## Validation\n- bun run format:check\n- bun run lint\n- bun test
