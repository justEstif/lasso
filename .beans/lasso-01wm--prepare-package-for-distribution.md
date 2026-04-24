---
# lasso-01wm
title: Prepare package for distribution
status: completed
type: feature
priority: normal
created_at: 2026-04-24T18:33:53Z
updated_at: 2026-04-24T18:36:26Z
parent: lasso-shbx
---

Prepare package metadata, package contents, and install smoke validation for publishing lasso.

## Summary of Changes\n- Updated package name to @justestif/lasso with v0.1.0 metadata\n- Removed private package flag and added license, description, keywords, and files allowlist\n- Added Bun shebang to CLI entrypoint so installed bin works via bunx\n- Added package metadata test coverage\n- Verified package dry run contents\n- Smoke tested packed tarball install and ran lasso --help, setup, and status from an external temp project\n\n## Validation\n- bun run format:check\n- bun run lint\n- bun test\n- bun pm pack --dry-run\n- packed tarball install smoke test
