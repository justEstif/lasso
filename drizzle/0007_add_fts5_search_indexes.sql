-- FTS5 virtual table for observation_entries (content + category)
CREATE VIRTUAL TABLE IF NOT EXISTS observation_entries_fts USING fts5(
  content,
  category,
  content='observation_entries',
  content_rowid='rowid'
);
--> statement-breakpoint

-- Triggers to keep observation_entries FTS in sync
CREATE TRIGGER IF NOT EXISTS observation_entries_ai AFTER INSERT ON observation_entries BEGIN
  INSERT INTO observation_entries_fts(rowid, content, category)
  VALUES (new.rowid, new.content, new.category);
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS observation_entries_ad AFTER DELETE ON observation_entries BEGIN
  INSERT INTO observation_entries_fts(observation_entries_fts, rowid, content, category)
  VALUES ('delete', old.rowid, old.content, old.category);
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS observation_entries_au AFTER UPDATE ON observation_entries BEGIN
  INSERT INTO observation_entries_fts(observation_entries_fts, rowid, content, category)
  VALUES ('delete', old.rowid, old.content, old.category);
  INSERT INTO observation_entries_fts(rowid, content, category)
  VALUES (new.rowid, new.content, new.category);
END;
--> statement-breakpoint

-- FTS5 virtual table for memory_snapshots (content)
CREATE VIRTUAL TABLE IF NOT EXISTS memory_snapshots_fts USING fts5(
  content,
  content='memory_snapshots',
  content_rowid='rowid'
);
--> statement-breakpoint

-- Triggers to keep memory_snapshots FTS in sync
CREATE TRIGGER IF NOT EXISTS memory_snapshots_ai AFTER INSERT ON memory_snapshots BEGIN
  INSERT INTO memory_snapshots_fts(rowid, content)
  VALUES (new.rowid, new.content);
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS memory_snapshots_ad AFTER DELETE ON memory_snapshots BEGIN
  INSERT INTO memory_snapshots_fts(memory_snapshots_fts, rowid, content)
  VALUES ('delete', old.rowid, old.content);
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS memory_snapshots_au AFTER UPDATE ON memory_snapshots BEGIN
  INSERT INTO memory_snapshots_fts(memory_snapshots_fts, rowid, content)
  VALUES ('delete', old.rowid, old.content);
  INSERT INTO memory_snapshots_fts(rowid, content)
  VALUES (new.rowid, new.content);
END;
