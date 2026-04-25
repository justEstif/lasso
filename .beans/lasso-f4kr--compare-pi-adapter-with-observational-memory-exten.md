---
# lasso-f4kr
title: Compare Pi adapter with observational memory extension
status: completed
type: task
priority: normal
created_at: 2026-04-25T00:49:49Z
updated_at: 2026-04-25T00:50:23Z
---

Compare current lasso Pi adapter behavior against the observational-memory extension and identify why lasso is not actively reviewing.

- [x] Read observational-memory extension README/code
- [x] Inspect lasso Pi adapter/template
- [x] Compare lifecycle hooks and active review behavior
- [x] Recommend fixes

## Summary of Changes

Compared the existing lasso Pi adapter/template against the observational-memory extension. Found that lasso currently only shells out to status commands from Pi lifecycle hooks and does not serialize conversation context, run observers with turn content, inject memory, or perform compaction-time reflection.
