---
# lasso-1z4p
title: Extract shared observer service architecture
status: draft
type: epic
created_at: 2026-04-25T15:58:44Z
updated_at: 2026-04-25T15:58:44Z
blocking:
    - lasso-3tgk
blocked_by:
    - lasso-93aq
---

Factor out shared observer patterns into a service that all observers (memory, lint, future) register with.

## Problem
Both memory and lint observers duplicate the same lifecycle: turn_end trigger → serialize conversation → check thresholds → call LLM → persist results → update status. Adding a 3rd observer means copying it again.

## What the service owns
- Trigger gating (token budget, turn count, throttle) — shouldObserve()
- Conversation serialization and unobserved delta tracking
- Lifecycle: observe() → persist() → reflect()
- Temporal base schema (observed_at, referenced_date, relative_offset)
- Dedup primitives (hash, fingerprint, similarity)
- DB connection and status bar updates
- Observer registration and discovery

## What each observer provides (plugin interface)
- Name and config shape
- shouldObserve override (custom logic beyond token budget)
- Prompt builder (conversation → LLM prompt)
- Result parser (LLM output → structured data)
- Schema extension (observer-specific columns/tables)
- Status summary fn

## Why after memory observer
Ship memory observer improvements first — they prove the patterns work. Then extract into a service as a refactoring step. This gives us a clean plugin API before we tackle lint optimization and any future observers.

## Dependency chain
- Blocked by: lasso-93aq (memory observer optimization)
- Blocks: lasso-3tgk (lint observer optimization), future observers
