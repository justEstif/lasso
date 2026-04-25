import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';

import { defaultConfig } from '../src/config/load.ts';
import { runMigrations } from '../src/db/migrations.ts';
import { createEntry } from '../src/observers/lint/db.ts';
import { createSnapshot } from '../src/observers/memory/db.ts';
import { renderDashboard } from '../src/tui/dashboard.tsx';

describe('tui dashboard renderer', () => {
  test('renders observer status and recent records', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    createEntry(db, {
      affected_paths: JSON.stringify([]),
      category: null,
      description: 'Prefer Bun.write for file writes',
      detector_version: 'test',
      proposed_form: null,
      referenced_date: null,
      relative_offset: null,
      severity: 'medium',
      source_excerpt: null,
      status: 'proposed',
    });
    createSnapshot(db, {
      content: 'Use Drizzle migrations instead of custom migrator.',
      scope: 'thread',
    });

    const output = renderDashboard(db, defaultConfig);

    expect(output).toContain('lint observer');
    expect(output).toContain('memory observer');
    expect(output).toContain('Prefer Bun.write');
    expect(output).toContain('Use Drizzle migrations');
  });
});
