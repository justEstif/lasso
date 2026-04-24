---
# lasso-10ia
title: Add lasso TUI command
status: completed
type: feature
priority: normal
created_at: 2026-04-24T18:14:29Z
updated_at: 2026-04-24T18:17:20Z
parent: lasso-r2l5
---

Add an interactive terminal UI command for viewing lasso observer status and recent records.

## Summary of Changes\n- Added an Ink-based lasso tui command\n- Added --once mode for non-interactive rendering and tests\n- Added interactive Ink dashboard with q to quit and r to refresh\n- Dashboard shows lint status, memory status, and recent records\n- Added unit and CLI integration tests\n\n## Validation\n- bun run format:check\n- bun run lint\n- bun test
