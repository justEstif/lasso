---
# lasso-mbbs
title: Introduce database abstraction boundary
status: completed
type: task
priority: high
created_at: 2026-04-25T21:31:28Z
updated_at: 2026-04-25T22:07:18Z
parent: lasso-a2px
---

Hide concrete database driver behind a LassoDb abstraction.

- [ ] Stop leaking bun:sqlite Database through CLI/observer interfaces
- [ ] Pass Drizzle database instance through repository functions
- [ ] Remove repeated drizzle(db) wrapper calls
- [ ] Keep tests passing before/while swapping driver



## Summary

Introduced `LassoDb` type alias that hides the concrete PGlite driver. All consumer code now receives the Drizzle query builder, never the raw driver. Removed all 38 `drizzle(db)` wrapper calls. Functions now take `LassoDb` directly. Tests pass with shared in-memory PGlite instance and TRUNCATE isolation.
