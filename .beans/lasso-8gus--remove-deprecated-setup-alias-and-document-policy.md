---
# lasso-8gus
title: Remove deprecated setup alias and document policy
status: completed
type: task
priority: normal
created_at: 2026-04-24T18:32:02Z
updated_at: 2026-04-24T18:33:07Z
parent: lasso-shbx
---

Remove unnecessary deprecated setup alias support and add an AGENTS.md directive to avoid retaining deprecated compatibility unless requested.

## Summary of Changes\n- Removed deprecated --pi setup alias\n- Updated setup tests to use --harness pi\n- Removed deprecated compatibility path from setup internals\n- Added AGENTS.md directive to remove deprecated aliases/compatibility unless explicitly requested\n\n## Validation\n- bun run format:check\n- bun run lint\n- bun test
