---
# lasso-9t4h
title: Active harness observation loop
status: completed
type: epic
priority: high
created_at: 2026-04-25T00:52:17Z
updated_at: 2026-04-25T00:58:56Z
---

Restore the core MVP contract: harness adapters must actively pass conversation context into lasso observers and mirror lasso commands, rather than only rendering status.

## Problem

The current Pi adapter is only a status bridge. It runs status commands on lifecycle hooks but does not serialize the Pi conversation, does not invoke observer scans with session content, and does not mirror /lasso:*:* commands. This misses the MVP goal that lasso observers watch live agent sessions.

## Scope

- [x] Define the adapter contract for active observation
- [x] Make Pi adapter serialize recent/unobserved conversation from Pi lifecycle context
- [x] Invoke lint and memory observers asynchronously with conversation input
- [x] Fix CLI stdin behavior needed by adapters, especially lint scan
- [x] Mirror /lasso:* slash commands to CLI invocations
- [x] Render meaningful observer state in Pi footer/status
- [x] Add tests for CLI stdin behavior and generated Pi extension behavior
- [x] Decide follow-up scope for memory parity with legacy observational-memory extension

## Acceptance Criteria

- After a Pi turn, lasso receives serialized conversation text and can persist observer output without manual terminal commands.
- /lasso:lint:* and /lasso:memory:* commands work from Pi by translating to CLI commands.
- Status/footer reflects real observer state after active runs.
- Tests prove the adapter is active, not merely a status bridge.

## Adapter Interface Note

The active observation work must define an explicit harness adapter contract before hard-coding Pi-specific behavior. Future adapters for Claude Code, Codex, and other harnesses should implement the same interface:

- lifecycle hooks: session start, turn end/on idle, before compaction where available
- conversation serialization/input contract: adapters pass recent or unobserved conversation to lasso via stdin or temp file
- command mirror contract: /lasso:* slash commands map mechanically to lasso CLI commands
- status contract: adapters render observer state in the host-native footer/status surface
- non-blocking execution contract: automatic observer runs must not block the main agent turn
- capability differences: adapters should degrade gracefully when a harness lacks prompt injection, compaction hooks, or footer APIs

The Pi adapter should be the first implementation of this contract, not the place where the contract is implicitly invented.

## Summary of Changes

Completed the active harness observation loop epic for the MVP regression. Defined the reusable harness adapter contract as TypeScript interfaces in src/adapters/contract.ts, made the Pi adapter the first implementation, wired Pi turn-end lifecycle events to pass serialized conversation text into lasso lint and memory observers, added slash-command mirrors, and made observer footer/status reflect actual CLI state. Created follow-up lasso-wewn for deeper memory parity with the legacy Pi observational-memory extension.

## Validation

- bun run format:check
- bun run lint
- bun test
- bunx tsc --noEmit
