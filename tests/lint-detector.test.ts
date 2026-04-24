import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';

import { runMigrations } from '../src/db/migrations.ts';
import { getRecurrences, listEntries } from '../src/observers/lint/db.ts';
import {
  applyDetectorResult,
  extractJsonObject,
  parseDetectorResult,
} from '../src/observers/lint/detector.ts';

function createMigratedDatabase() {
  const db = new Database(':memory:');
  runMigrations(db);
  return db;
}

describe('lint detector entry creation', () => {
  test('creates proposed lint entries from detector JSON', () => {
    const db = createMigratedDatabase();
    const result = parseDetectorResult(
      JSON.stringify({
        entries: [
          {
            description: 'Avoid antd imports in migrated pages',
            matches_existing_id: null,
            proposed_form: 'no-restricted-imports: antd',
            source_excerpt: 'stop pulling Form.Item from antd',
          },
        ],
        found_opportunity: true,
        reasoning: 'User stated a recurring convention.',
      }),
    );

    const summary = applyDetectorResult(db, result);
    const entries = listEntries(db);

    expect(summary.created).toBe(1);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.status).toBe('proposed');
    expect(entries[0]?.detector_version).toBe('lint-rubric-v1');
  });
});

describe('lint detector output parsing', () => {
  test('extracts JSON from fenced detector output', () => {
    const json = extractJsonObject(
      'Here is the result:\n```json\n{"found_opportunity":false,"reasoning":"none","entries":[]}\n```',
    );
    const result = parseDetectorResult(json);

    expect(result.found_opportunity).toBe(false);
  });

  test('rejects invalid detector output with schema errors', () => {
    expect(() => parseDetectorResult('{"reasoning":"missing fields","entries":[]}')).toThrow();
    expect(() =>
      parseDetectorResult('{"found_opportunity":true,"reasoning":"ok","entries":{}}'),
    ).toThrow();
    expect(() =>
      parseDetectorResult(
        JSON.stringify({
          entries: [{ description: '', matches_existing_id: null }],
          found_opportunity: true,
          reasoning: 'empty description',
        }),
      ),
    ).toThrow();
  });
});

describe('lint detector recurrence handling', () => {
  test('adds recurrence for matched existing entry', () => {
    const db = createMigratedDatabase();
    const created = applyDetectorResult(db, {
      entries: [
        {
          description: 'Avoid antd imports in migrated pages',
          matches_existing_id: null,
        },
      ],
      found_opportunity: true,
      reasoning: 'Initial signal.',
    });
    expect(created.created).toBe(1);

    const existing = listEntries(db)[0];
    const summary = applyDetectorResult(db, {
      entries: [
        {
          description: 'Avoid antd imports in migrated pages',
          matches_existing_id: existing?.id ?? '',
          source_excerpt: 'again, no antd here',
        },
      ],
      found_opportunity: true,
      reasoning: 'Duplicate signal.',
    });

    expect(summary.recurrences).toBe(1);
    expect(getRecurrences(db, existing?.id ?? '')).toHaveLength(1);
  });
});
