---
# lasso-oe9z
title: Add design-oriented ESLint rules
status: completed
type: task
priority: normal
created_at: 2026-04-24T13:22:05Z
updated_at: 2026-04-24T13:24:13Z
---

Explore whether Ousterhout-style design principles can be encoded in eslint.config.js and add pragmatic lint rules where beneficial.

- [x] Inspect current ESLint setup and dependencies
- [x] Identify rules that map to design principles without excessive noise
- [x] Update eslint.config.js
- [x] Run lint/tests as appropriate
- [x] Summarize tradeoffs

## Summary of Changes

Added pragmatic design-oriented ESLint rules that encode complexity and obviousness checks: file/function size limits, nesting/callback limits, parameter/statement limits, straightforward control flow, no parameter reassignment, cognitive complexity, collapsible-if detection, and repeated-string detection. Verified with `bun run lint` and `bun test`.

Tradeoff: lint rules can catch measurable symptoms of design complexity, but cannot judge module depth or information hiding fully; those still require review.
