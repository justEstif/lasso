---
# lasso-naou
title: Implement deterministic memory dedupe and retrieval
status: completed
type: feature
priority: normal
created_at: 2026-04-25T12:56:42Z
updated_at: 2026-04-25T13:01:18Z
---

Implement non-LLM memory storage/retrieval improvements.

- [x] Inspect memory schema and migrations
- [x] Add deterministic dedupe metadata
- [x] Implement exact/near duplicate observe handling
- [x] Add focused memory context/export behavior
- [x] Add tests
- [x] Run quality checks
- [x] Summarize changes

## Summary of Changes

Implemented deterministic, non-LLM memory dedupe and focused retrieval. Memory snapshots now store normalized hashes, SimHash fingerprints, last-seen timestamps, seen counts, and supersession metadata. `memory observe` reuses exact or near-duplicate snapshots instead of appending repeats, incrementing `seen_count`. Added `lasso memory context --query` to return focused local memory ranked by lexical overlap, and changed the Pi extension to inject focused context instead of full memory export. Added migration `0001_memory_dedupe`, fingerprint utilities, and tests for dedupe, context ranking, migration count, CLI context, and generated Pi extension behavior.

Quality checks run: `bun run lint`, `bunx tsc --noEmit`, `bun run format:check`, `bun test`.
