---
# lasso-wewn
title: Bring memory observer to legacy Pi OM parity
status: completed
type: feature
priority: normal
created_at: 2026-04-25T00:57:01Z
updated_at: 2026-04-25T01:09:33Z
parent: lasso-9t4h
---

Follow-up from active harness observation loop: evaluate and close remaining gaps between lasso memory observer and the legacy Pi observational-memory extension.

- [x] Define exact parity requirements for observation summaries, reflection, prompt injection, and legacy import
- [x] Implement model-backed memory observation/reflection if required
- [x] Add compaction/reflection integration where harnesses expose it
- [x] Add tests comparing expected behavior to the legacy OM extension contract

## Progress

Implemented the Pi-side memory parity hooks that the legacy OM extension relies on: before-agent prompt injection from lasso memory export and session_before_compact reflection using messagesToSummarize, turnPrefixMessages, previousSummary, firstKeptEntryId, and tokensBefore. Kept lasso memory observe/reflect as persistence commands while the Pi adapter owns model generation. Tests now assert prompt injection, compaction hook wiring, Pi-side model prompt helpers, and stdin-backed memory reflection persistence.

## Validation

- bun run format:check
- bun run lint
- bun test
- bunx tsc --noEmit

## Summary of Changes

Aligned memory parity with the corrected boundary: lasso remains the SQLite persistence/triage CLI while the Pi harness performs model-backed memory observation and reflection using Pi model access. The generated Pi extension now builds memory observer/reflector prompts, calls Pi models via completeSimple/modelRegistry, persists generated summaries through lasso memory observe/reflect over stdin, injects lasso memory before agent start, and returns model-generated summaries from session_before_compact. Removed the adapter dependency on memory reflect --emit-content because the harness already owns the generated summary.

## Validation

- bun run format:check
- bun run lint
- bun test
- bunx tsc --noEmit
