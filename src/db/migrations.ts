import { Database } from 'bun:sqlite';

export function runMigrations(db: Database) {
  createMigrationsTable(db);
  applyLintMigrations(db);
  applyMemoryMigrations(db);
}

function applyLintMigrations(db: Database) {
  applyMigration(db, 'lint', 1, () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS lint_entries (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        description TEXT NOT NULL,
        proposed_form TEXT,
        source_excerpt TEXT,
        detector_version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lint_recurrences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_id TEXT NOT NULL REFERENCES lint_entries(id),
        note TEXT NOT NULL,
        observed_at TEXT NOT NULL
      );
    `);
  });

  applyMigration(db, 'lint', 2, () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS lint_scan_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scanned_at TEXT NOT NULL,
        created_count INTEGER NOT NULL,
        recurrence_count INTEGER NOT NULL,
        skipped_count INTEGER NOT NULL
      );
    `);
  });
}

function applyMemoryMigrations(db: Database) {
  applyMigration(db, 'memory', 1, () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS memory_snapshots (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_reflections (
        id TEXT PRIMARY KEY,
        consolidated_content TEXT NOT NULL,
        source_snapshot_ids TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  });
}

function applyMigration(db: Database, observer: string, version: number, up: () => void) {
  const checkStmt = db.prepare('SELECT 1 FROM _migrations WHERE observer = ? AND version = ?');
  const isApplied = checkStmt.get(observer, version) !== null;

  if (!isApplied) {
    // Run the migration transaction
    db.transaction(() => {
      up();

      const insertStmt = db.prepare(
        'INSERT INTO _migrations (observer, version, applied_at) VALUES (?, ?, ?)',
      );
      insertStmt.run(observer, version, new Date().toISOString());
    })();
  }
}

function createMigrationsTable(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      observer TEXT NOT NULL,
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL,
      PRIMARY KEY (observer, version)
    );
  `);
}
