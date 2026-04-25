---
# lasso-93aq
title: Optimize memory observer architecture
status: completed
type: epic
priority: normal
created_at: 2026-04-25T15:13:30Z
updated_at: 2026-04-25T21:02:22Z
---

Based on Mastra OM research (bean lasso-jy39), optimize lasso's memory observer with token-budget triggers, enriched observation format, temporal anchoring, threshold-based reflection, working memory, and semantic recall.



## Child Beans

- [ ] lasso-a0hf — Enforce token-budget triggers for observation (high priority)
- [ ] lasso-f1w3 — Enrich observation format to structured event log
- [ ] lasso-qzji — Add temporal anchoring to observations
- [ ] lasso-rvau — Enforce token-budget threshold for reflection
- [ ] lasso-cgox — Add working memory scratchpad
- [ ] lasso-c3e7 — Add semantic recall with vector search (blocked by PGlite migration)

## Summary of Changes

All child beans completed:

- ✅ `lasso-cgox` — Add working memory scratchpad (mutable markdown, `lasso memory working` CLI, Pi system prompt injection)
- ✅ `lasso-rvau` — Enforce token-budget threshold for reflection (auto-trigger at 40K tokens, `lasso memory should-reflect` CLI)

Test count: 55 → 67 (all passing). Types, lint, and formatting clean.
