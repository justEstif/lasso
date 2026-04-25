---
# lasso-etp3
title: Clarify Pi adapter host capabilities
status: completed
type: bug
priority: normal
created_at: 2026-04-25T00:59:48Z
updated_at: 2026-04-25T01:00:45Z
parent: lasso-9t4h
---

Correct misleading Pi adapter capability metadata: Pi supports compaction hooks (and prompt injection hooks), even if the current lasso adapter has not implemented those paths yet.

- [x] Rename capability metadata to distinguish host support from implemented adapter behavior
- [x] Update Pi capability values/tests
- [x] Run validation

## Summary of Changes

Reviewed the Pi custom compaction example and corrected the source type/name to describe host capabilities rather than implemented adapter behavior. Pi host capabilities now mark compaction hooks and prompt injection as supported.

## Validation

- bun run format:check
- bun run lint
- bun test tests/pi-adapter.test.ts
- bunx tsc --noEmit
