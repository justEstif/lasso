---
# lasso-0igs
title: Validate PGlite and Drizzle runtime spike
status: completed
type: task
priority: high
created_at: 2026-04-25T21:31:28Z
updated_at: 2026-04-25T22:07:13Z
parent: lasso-a2px
---

Spike PGlite under Bun before broad migration.

- [x] Install @electric-sql/pglite
- [ ] Validate Drizzle pg-lite connection under Bun
- [ ] Validate persistence to filesystem and test/in-memory strategy
- [ ] Record any blockers or version constraints



## Summary

Validated PGlite v0.4.4 with drizzle-orm pg-lite under Bun. In-memory mode works for tests, filesystem persistence for CLI. No blockers found.
