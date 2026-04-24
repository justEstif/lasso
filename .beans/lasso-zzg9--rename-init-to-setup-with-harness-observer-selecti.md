---
# lasso-zzg9
title: Rename init to setup with harness observer selection
status: completed
type: feature
priority: normal
created_at: 2026-04-24T18:28:40Z
updated_at: 2026-04-24T18:31:34Z
parent: lasso-shbx
---

Replace init with setup, default harness to Pi, support observer selection, and show observer descriptions in parentheses.

## Summary of Changes\n- Replaced user-facing lasso init command with lasso setup\n- Added harness config with Pi as the default harness\n- Added --harness pi and --observers lint,memory setup options\n- Added observer descriptions in parentheses in setup output\n- Added observer enablement based on setup selection\n- Updated setup tests and CLI integration coverage\n\n## Validation\n- bun run format:check\n- bun run lint\n- bun test
