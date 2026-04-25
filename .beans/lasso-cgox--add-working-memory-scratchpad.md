---
# lasso-cgox
title: Add working memory scratchpad
status: todo
type: feature
created_at: 2026-04-25T15:20:04Z
updated_at: 2026-04-25T15:20:04Z
parent: lasso-93aq
---

A small structured markdown block that's always in context, complementing observations. Stored in DB, updated independently.

Mastra's working memory is like the agent's active thoughts — persistent facts about the user/project that should always be available. Unlike observations (event log), working memory is a living document.

Implementation:
- Add working_memory table: id, resource_id, thread_id, content (markdown), updated_at
- Default template: project name, tech stack, current task, open questions
- CLI commands: `lasso memory working` to view/edit
- Pi extension injects working memory into system prompt on every turn
- Updated by the observer when facts change (not on every turn)

Scope: thread-scoped or resource-scoped (same as observations config).

This is separate from observations — observations are append-only events, working memory is mutable state.
