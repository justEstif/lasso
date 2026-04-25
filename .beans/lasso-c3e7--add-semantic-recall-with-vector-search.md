---
# lasso-c3e7
title: Add semantic recall with vector search
status: draft
type: feature
created_at: 2026-04-25T15:20:15Z
updated_at: 2026-04-25T15:20:15Z
parent: lasso-93aq
blocked_by:
    - lasso-a2px
---

Enable vector-based retrieval of raw messages behind observations. When the compressed summary loses exact wording you need, semantic recall finds the source.

Blocked by PGlite migration (lasso-a2px) which brings pgvector support.

Implementation (post-PGlite):
- Add embeddings column to observation snapshots using pgvector
- Generate embeddings for new observations at persist time
- Add recall command: `lasso memory recall --query <text>` for semantic search
- Pi extension can inject semantically relevant memories alongside recent observations
- Mastra's approach: browsing mode (no vectors, just raw message ranges) + optional vector search
