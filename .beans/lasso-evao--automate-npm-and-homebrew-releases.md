---
# lasso-evao
title: Automate npm and Homebrew releases
status: completed
type: feature
priority: normal
created_at: 2026-04-24T18:41:52Z
updated_at: 2026-04-24T18:44:34Z
parent: lasso-shbx
---

Publish lasso to npm from GitHub tags and update the Homebrew tap at /home/estifanos/Documents/projects/homebrew-tap.

## Summary of Changes\n- Added GitHub Actions release workflow triggered by v*.*.* tags\n- Workflow validates format, lint, tests, pack dry run, then publishes @justestif/lasso to npm\n- Workflow updates justEstif/homebrew-tap Formula/lasso.rb after npm publish\n- Added package repository/homepage/bugs metadata\n- Documented GitHub release secrets and tag publishing flow\n- Added local Homebrew formula and tap README entry in /home/estifanos/Documents/projects/homebrew-tap\n\n## Validation\n- bun run format\n- bun run lint\n- bun test\n- bun pm pack --dry-run
