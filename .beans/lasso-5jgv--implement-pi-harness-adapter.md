---
# lasso-5jgv
title: Implement Pi harness adapter
status: completed
type: task
priority: normal
created_at: 2026-04-24T18:08:47Z
updated_at: 2026-04-24T18:09:57Z
parent: lasso-u6bl
---

Add a thin Pi-facing adapter script that invokes lasso CLI lifecycle commands for lint and memory observers.

## Summary of Changes\n- Added a project-local Pi extension under .pi/extensions/lasso.ts\n- Hooked Pi session_start and turn_end lifecycle events to shell out to lasso status commands\n- Added /lasso-status command for combined lint and memory status\n- Added reusable Pi adapter command mapping helper and tests\n\n## Validation\n- bun run format\n- bun run lint\n- bun test
