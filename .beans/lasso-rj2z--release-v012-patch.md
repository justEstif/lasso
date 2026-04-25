---
# lasso-rj2z
title: Release v0.1.2 patch
status: completed
type: task
priority: high
created_at: 2026-04-25T01:18:48Z
updated_at: 2026-04-25T01:19:43Z
---

Cut a new patch release for the onboarding/adapter fixes by bumping package version, tagging, pushing, and relying on release automation to publish npm/Homebrew.

- [x] Bump package version to 0.1.2
- [x] Run validation
- [x] Commit version bump with bean
- [x] Create v0.1.2 git tag
- [x] Push main and tag

## Summary of Changes

Bumped package.json to 0.1.2, validated the package, committed the release bump, created the v0.1.2 git tag, and pushed main plus tags to trigger release automation.

## Validation

- bun run format:check
- bun run lint
- bun test
- bunx tsc --noEmit
- bun pm pack --dry-run
