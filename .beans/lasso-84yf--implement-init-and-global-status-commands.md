---
# lasso-84yf
title: Implement init and global status commands
status: completed
type: feature
priority: normal
created_at: 2026-04-24T18:19:58Z
updated_at: 2026-04-24T18:21:38Z
parent: lasso-shbx
---

Add lasso init for project setup and lasso status for combined observer status.

## Summary of Changes\n- Added lasso init for project-local .lasso/config.json creation\n- Added --detector-command, --force, and --pi init options\n- Added project-local Pi extension generation for init --pi\n- Added top-level lasso status combining lint and memory status\n- Added unit and CLI integration tests for init/status onboarding flow\n\n## Validation\n- bun run format:check\n- bun run lint\n- bun test
