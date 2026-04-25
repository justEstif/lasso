---
# lasso-jy39
title: default token window
status: completed
type: task
priority: normal
created_at: 2026-04-25T15:00:51Z
updated_at: 2026-04-25T15:18:12Z
---

not sure if we are running the observor for lasso too often or not?

review the docs here: https://mastra.ai/docs/memory/observational-memory

as well as do a web search for observational-memory

just want to make sure we are optimizing and not overwheliming by running it too often

alsl checkout the how they do scope(session vs cross session) and identify some learnings from them

https://mastra.ai/docs/memory/overview

https://mastra.ai/docs/memory/working-memory

https://mastra.ai/docs/memory/semantic-recall

https://mastra.ai/docs/memory/memory-processors

I feel like we can learn a lot from them



## Research Findings

### Current State of lasso Memory Observer
- **Trigger**: Every `turn_end` event in Pi (via the extension template)
- **What it does**: Serializes the full Pi conversation → sends to an LLM with an observer prompt → persists the summary as a snapshot via `lasso memory observe`
- **Dedup**: Uses normalized hash + SimHash fingerprint + token similarity (0.6 threshold) to avoid duplicate snapshots
- **Reflection**: Only triggered on Pi's `session_before_compact` event (compaction hook)
- **Config**: `observationThreshold: 12,000` tokens and `reflectionThreshold: 40,000` tokens exist in config but are **not used** anywhere — the observer runs every single turn

### Mastra OM Architecture (Key Learnings)
1. **Token-budget triggers, not turn-based**: Mastra only runs the Observer when unobserved message history exceeds 30K tokens (default). This is the #1 insight — lasso runs every turn, which is excessive.
2. **Three-tier system**: Recent messages → Observations → Reflections. Each tier has its own token threshold.
3. **Append-only observations**: Observations are formatted text (dated, emoji-prioritized bullets), not structured JSON. The context prefix stays stable = prompt-cacheable.
4. **Reflector threshold**: Runs when observations exceed 40K tokens. Not just on compaction events.
5. **Temporal anchoring**: Every observation carries date, referenced date, and relative date — critical for temporal reasoning.
6. **Observation format**: Two-level bulleted lists, emoji priorities (🔴🟡🟢), titles + timestamps. Much richer than lasso's current single-summary approach.
7. **Scope**: Thread scope (default) or resource scope (cross-conversation, experimental).
8. **Compression**: 3–6× for text, 5–40× for tool-call-heavy workloads.
9. **Working Memory**: Separate from observations — a structured markdown template always in context (like a user profile scratchpad). Updated independently.
10. **Semantic Recall**: Vector-based retrieval of raw messages behind observations (optional). Useful when you need exact wording the summary compressed away.
11. **Memory Processors**: Pipeline that filters/transforms messages before they reach the LLM. Auto-added when memory is enabled.
12. **Token-tiered model selection**: Use cheaper models for smaller observation runs, stronger models for larger contexts.

### Gap Analysis: lasso vs Mastra OM

| Feature | lasso (current) | Mastra OM |
|---|---|---|
| Trigger cadence | Every turn | Token-budget (30K default) |
| Observation format | Single summary string | Dated, prioritized event log |
| Observation prompt | Extract summary/JSON | Structured event-based notes |
| Temporal anchoring | None | 3-date model (observed, referenced, relative) |
| Working memory | Not implemented | Separate markdown scratchpad |
| Semantic recall | Token-based search only | Vector embeddings + recall tool |
| Reflection trigger | Only Pi compaction event | Token-budget (40K default) |
| Token thresholds (configured) | 12K obs / 40K refl (unused) | 30K obs / 40K refl (enforced) |
| Dedup | Hash + SimHash + token similarity | N/A (append-only, no dedup needed) |
| Scope | thread/resource config | thread (default) or resource (experimental) |
| Model selection | Single model | Token-tiered model selection |

### Recommendations

1. **Enforce token-budget triggers**: The config already has `observationThreshold: 12_000` and `reflectionThreshold: 40_000` — actually use them. Only observe when unobserved turns exceed the threshold. This is the biggest optimization.
2. **Enrich observation format**: Switch from single-summary JSON to Mastra's dated, prioritized event log format (🔴🟡🟢 bullets). More useful context, better for reflection.
3. **Add temporal anchoring**: Include observation date, referenced dates, and relative dates in snapshots.
4. **Enforce reflection threshold**: Run the reflector when observations exceed the threshold, not just on compaction events.
5. **Consider working memory**: A small structured markdown block always in context (project name, tech stack, current task) would complement observations well.
6. **The observer is not running too often — it's running on every turn unnecessarily.** Mastra only triggers at 30K tokens of unobserved history. For a typical coding agent turn (~500–2K tokens), that means ~15–60 turns between observations. lasso currently runs every turn.



## Summary of Changes

Research complete. Findings documented in bean body. Created follow-up epic lasso-93aq (optimize memory observer architecture) and lasso-a2px (PGlite migration) for implementation.
