---
# lasso-wewn
title: Bring memory observer to legacy Pi OM parity
status: in-progress
type: feature
priority: normal
created_at: 2026-04-25T00:57:01Z
updated_at: 2026-04-25T01:04:05Z
parent: lasso-9t4h
---

Follow-up from active harness observation loop: evaluate and close remaining gaps between lasso memory observer and the legacy Pi observational-memory extension.

- [x] Define exact parity requirements for observation summaries, reflection, prompt injection, and legacy import
- [ ] Implement model-backed memory observation/reflection if required
- [x] Add compaction/reflection integration where harnesses expose it
- [x] Add tests comparing expected behavior to the legacy OM extension contract

## Progress

Implemented the Pi-side memory parity hooks that the legacy OM extension relies on: before-agent prompt injection from lasso memory export and session_before_compact reflection using messagesToSummarize, turnPrefixMessages, previousSummary, firstKeptEntryId, and tokensBefore. Added --emit-content to memory reflect so the adapter can persist a reflection and return compaction-ready content to Pi. Tests now assert prompt injection, compaction hook wiring, and memory reflect emitted content.

## Validation

- bun run format:check
- bun run lint
- bun test
- bunx tsc --noEmit
