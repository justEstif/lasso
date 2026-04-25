---
# lasso-qzji
title: Add temporal anchoring to observations
status: todo
type: feature
created_at: 2026-04-25T15:19:31Z
updated_at: 2026-04-25T15:19:31Z
parent: lasso-93aq
---

Add three-date temporal model to observation entries, stored in DB.

Mastra tracks up to three dates per observation:
- Observation date: when the observation was created
- Referenced date: the date mentioned in content itself ("my flight is January 31")
- Relative date: computed offset ("2 days from today")

Implementation:
- Add columns to observation entries: observed_at, referenced_date, relative_offset
- Observer prompt extracts date references from conversation content
- CLI can filter/sort by any date dimension
- Critical for temporal reasoning (Mastra scores 95.5% on temporal tasks with this)

This pairs with the enriched observation format bean (lasso-f1w3).
