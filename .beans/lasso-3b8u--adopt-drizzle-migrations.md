---
# lasso-3b8u
title: Adopt Drizzle migrations
status: completed
type: task
priority: normal
created_at: 2026-04-24T18:06:10Z
updated_at: 2026-04-24T18:07:14Z
parent: lasso-6agy
---

Replace the custom migration runner with drizzle-kit generated migrations and Drizzle's bun-sqlite runtime migrator.

## Summary of Changes\n- Added drizzle.config.ts with src/db/schema.ts as the code-first schema source\n- Generated initial Drizzle SQL migration under drizzle/\n- Replaced the custom _migrations runner with drizzle-orm/bun-sqlite/migrator\n- Added db:generate, db:migrate, and db:push scripts\n- Updated migration tests to assert Drizzle's __drizzle_migrations journal and idempotency\n\n## Validation\n- bun run format:check\n- bun run lint\n- bun test
