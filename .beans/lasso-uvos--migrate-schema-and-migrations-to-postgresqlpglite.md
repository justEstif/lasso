---
# lasso-uvos
title: Migrate schema and migrations to PostgreSQL/PGlite
status: completed
type: task
priority: high
created_at: 2026-04-25T21:31:29Z
updated_at: 2026-04-25T22:07:25Z
parent: lasso-a2px
---

Convert schema and migrations from SQLite to PostgreSQL/PGlite.

- [ ] Convert sqlite-core schema to pg-core
- [ ] Add PostgreSQL enums/timestamps/jsonb where appropriate
- [ ] Add indexes for existing query patterns
- [ ] Replace migration runner with PGlite-compatible migrations
- [ ] Preserve existing data migration story



## Summary

Converted `sqliteTable` to `pgTable` with pg enums, timestamptz (string mode), jsonb for arrays, and explicit indexes for all query patterns. Regenerated migrations as single PostgreSQL DDL file. Updated drizzle.config.ts to postgresql dialect. Drizzle migrator uses `drizzle-orm/pglite/migrator`. Migration journal lives in `drizzle` schema.
