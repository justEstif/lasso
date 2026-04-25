---
# lasso-s04o
title: Fix Pi memory reflect input and memory repetition
status: completed
type: bug
priority: normal
created_at: 2026-04-25T12:43:33Z
updated_at: 2026-04-25T12:47:01Z
---

Address two feedback items:

- [x] Reproduce/inspect Pi memory reflect command path
- [x] Fix lasso:memory:reflect to provide content/input correctly
- [x] Inspect repeated memory output behavior in dotfiles
- [x] Add/update tests
- [x] Run quality checks
- [x] Summarize changes

## Summary of Changes

Fixed the Pi `/lasso:memory:reflect` command so it reflects the current Pi conversation via stdin instead of invoking `memory reflect` with no content. Reduced repeated memory injection/export noise by collapsing near-duplicate snapshots and limiting exported snapshots to the five most recent distinct entries. Added integration coverage for stdin reflection, duplicate snapshot export collapse, and Pi extension generation.

Quality checks run: `bun test`, `bun run lint`, `bunx tsc --noEmit`, `bun run format:check`.
