---
# lasso-3tgk
title: Optimize lint observer architecture
status: draft
type: epic
created_at: 2026-04-25T15:56:51Z
updated_at: 2026-04-25T15:56:51Z
---

Apply shared observer patterns from the memory observer optimization (lasso-93aq) to the lint observer.

The lint observer shares the same core problems as memory — it runs on every turn_end, has unused threshold config (scanThresholdTokens: 5000, scanThresholdTurns: 10), and stores observations as flat blobs. After we ship the memory observer improvements, apply the same patterns here.

## Learnings to port from memory observer work

- **Token-budget triggers**: Lint already has scanThresholdTokens and scanThresholdTurns in config but they're unused. Enforce them the same way we do for memory.
- **Throttle is partial**: The throttleLimit (caps proposed entries) is a good start but doesn't prevent the LLM call itself. Token-budget gating would skip the detector entirely when there's not enough new conversation to scan.
- **Temporal anchoring**: Recurrences already track observed_at. Full temporal model (referenced dates, relative offsets) would help correlate lint signals across sessions.
- **Structured storage**: description is a blob today. Could benefit from richer schema (category, severity, affected paths) like the structured event log for memory.

## Lint-specific considerations

- Status transitions (proposed → accepted → implemented → rejected) are unique to lint — not a shared pattern
- Recurrence tracking is already solid — counts how often a pattern reappears
- Detector version tracking is lint-specific
- Throttle (stop proposing when too many pending) is lint-specific but the concept of 'pause observation when saturated' could generalize

## Blocked by
lasso-93aq (memory observer optimization) — extract shared patterns first, then port.
