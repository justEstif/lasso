---
# lasso-tydz
title: Use npm trusted publishing
status: completed
type: task
priority: normal
created_at: 2026-04-24T18:45:15Z
updated_at: 2026-04-24T18:45:49Z
parent: lasso-evao
---

Switch release workflow from long-lived npm token to npm trusted publishing with GitHub OIDC.

## Summary of Changes\n- Searched npm trusted publishing documentation\n- Replaced NPM_TOKEN-based npm publish with GitHub OIDC trusted publishing\n- Added id-token: write workflow permission and Node 24 setup for npm CLI trusted publishing\n- Switched publish step to npm publish --access public\n- Updated README release instructions to configure npm trusted publisher instead of NPM_TOKEN\n\n## Validation\n- bun run format:check\n- bun run lint\n- bun test
