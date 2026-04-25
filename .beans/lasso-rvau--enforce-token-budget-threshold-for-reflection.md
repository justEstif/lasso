---
# lasso-rvau
title: Enforce token-budget threshold for reflection
status: todo
type: feature
created_at: 2026-04-25T15:19:45Z
updated_at: 2026-04-25T15:19:45Z
parent: lasso-93aq
---

Run the reflector when observations exceed the reflection threshold, not just on Pi compaction events.

Current: reflector only fires on session_before_compaction (Pi-specific compaction hook).
Target: reflector also fires when total observation tokens exceed reflectionThreshold (40K default).

Implementation:
- Estimate total observation token count after each observation
- If threshold exceeded, trigger reflection automatically (async, non-blocking)
- Keep compaction hook as an additional trigger (orthogonal, not replacement)
- Reflection consolidates observations, drops superseded ones, keeps the event log bounded

The config already has reflectionThreshold: 40_000 — enforce it.
