---
# lasso-rop4
title: Build full opencode and Claude Code adapter modules
status: completed
type: task
priority: normal
created_at: 2026-04-26T14:41:54Z
updated_at: 2026-04-26T14:57:58Z
---

Implement HarnessAdapterContract for opencode and Claude Code with full lifecycle: observe, reflect, context inject, lint scan. Update templates to use adapters.\n\n- [ ] Create src/adapters/opencode/lasso.ts with host capabilities and command helpers\n- [ ] Create src/adapters/claude/lasso.ts with host capabilities and command helpers\n- [ ] Update opencode plugin template for full lifecycle\n- [ ] Update Claude Code hook template for full lifecycle\n- [ ] Add adapter tests\n- [ ] Update onboarding init if needed\n- [x] Run bun test, bunx tsc --noEmit, bunx eslint\n- [ ] Commit and push

## Summary of Changes\n\n- Added src/adapters/claude/lasso.ts and src/adapters/opencode/lasso.ts with host capabilities and command mapping.\n- Updated opencode plugin template for full lifecycle: context inject via system transform, observe via session.idle event, reflect via session.compacting, lint scan on idle.\n- Updated Claude Code templates: 3 hook scripts (user-prompt-submit, stop, pre-compact) covering context inject, observe+lint on stop, reflect on compact.\n- Updated .claude/settings.json to register all 3 hooks.\n- Added tests/adapter.test.ts covering all 3 adapters.\n- Updated tests/setup.test.ts and tests/setup-cli.test.ts for full lifecycle assertions.\n- 104 tests pass.
