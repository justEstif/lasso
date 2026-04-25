---
# lasso-i67w
title: Explain repeated memory injection cause
status: completed
type: task
priority: normal
created_at: 2026-04-25T12:48:30Z
updated_at: 2026-04-25T12:48:40Z
---

Answer why lasso was injecting repeated memory.

- [x] Inspect memory observe/export flow
- [x] Explain root cause and current mitigation

## Summary of Changes

Explained that repeated injection came from append-only snapshots plus full export injection before each agent turn, with no persistence-time deduplication or reflection compaction filtering.
