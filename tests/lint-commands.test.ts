import { describe, expect, test } from 'bun:test';

import type { LintStatus } from '../src/observers/lint/db.ts';

import { defaultConfig } from '../src/config/load.ts';
import { getMemoryDb } from '../src/db/index';
import { runMigrations } from '../src/db/migrations';
import {
  buildLintExportMarkdown,
  checkShouldScanLint,
  executeLintScan,
  executeLintTransition,
  formatLintStatusText,
  getLintListData,
  getLintShowData,
} from '../src/observers/lint/commands.ts';
import { createEntry, recordLintObservationProgress } from '../src/observers/lint/db.ts';
import { applyDetectorResult, parseDetectorResult } from '../src/observers/lint/detector.ts';
import { buildLintStatusModel } from '../src/observers/lint/status.ts';

function seedEntry(
  db: ReturnType<typeof testDb>,
  overrides: Partial<{
    category: string;
    description: string;
    severity: 'high' | 'low' | 'medium';
    status: LintStatus;
  }> = {},
) {
  return createEntry(db, {
    affected_paths: JSON.stringify([]),
    category: overrides.category ?? null,
    description: overrides.description ?? 'Test lint entry',
    detector_version: 'test',
    proposed_form: null,
    referenced_date: null,
    relative_offset: null,
    severity: overrides.severity ?? 'medium',
    source_excerpt: null,
    status: overrides.status ?? 'proposed',
  });
}

function testDb() {
  const db = getMemoryDb();
  runMigrations(db);
  return db;
}

const validDetectorOutput = JSON.stringify({
  entries: [
    {
      affected_paths: ['src/app.ts'],
      category: null,
      description: 'Agent ignores TypeScript strict mode',
      matches_existing_id: null,
      proposed_form: null,
      referenced_date: null,
      relative_offset: null,
      severity: 'high',
      source_excerpt: 'User: always use strict types',
    },
  ],
  found_opportunity: true,
  reasoning: 'User declared a convention.',
});

const emptyDetectorOutput = JSON.stringify({
  entries: [],
  found_opportunity: false,
  reasoning: 'No opportunities found.',
});

function buildRecurrenceOutput(existingId: string) {
  return JSON.stringify({
    entries: [
      {
        affected_paths: [],
        category: null,
        description: 'Recurrence note',
        matches_existing_id: existingId,
        proposed_form: null,
        referenced_date: null,
        relative_offset: null,
        severity: 'medium',
        source_excerpt: 'User: same issue again',
      },
    ],
    found_opportunity: true,
    reasoning: 'Matched.',
  });
}

// ---- executeLintScan ----

describe('lint scan prompt + skip', () => {
  test('executeLintScan returns prompt when printPrompt is true', async () => {
    const db = testDb();
    const result = await executeLintScan(
      db,
      { conversation: 'User: use strict types', printPrompt: true },
      defaultConfig,
    );
    expect(result.type).toBe('prompt');
    if (result.type === 'prompt') {
      expect(result.prompt).toContain('use strict types');
      expect(result.prompt).toContain('lasso lint detector');
    }
  });

  test('executeLintScan returns skipped when gate is closed', async () => {
    const db = testDb();
    recordLintObservationProgress(db, { observedTokens: 100_000, observedTurns: 100 });
    const result = await executeLintScan(
      db,
      { conversation: 'short', tokens: 100, turns: 1 },
      defaultConfig,
    );
    expect(result.type).toBe('skipped');
    if (result.type === 'skipped') expect(result.gates.tokenBudget.needed).toBe(false);
  });

  test('executeLintScan with force bypasses gate check', async () => {
    const db = testDb();
    recordLintObservationProgress(db, { observedTokens: 100_000, observedTurns: 100 });
    const result = await executeLintScan(
      db,
      { conversation: 'short', force: true, tokens: 100, turns: 1 },
      defaultConfig,
      () => Promise.resolve(emptyDetectorOutput),
    );
    expect(result.type).toBe('completed');
  });
});

describe('lint scan detector - completion', () => {
  test('executeLintScan returns completed with detector output', async () => {
    const db = testDb();
    const result = await executeLintScan(
      db,
      { conversation: 'User: use strict types', tokens: 10_000, turns: 10 },
      defaultConfig,
      () => Promise.resolve(validDetectorOutput),
    );
    expect(result.type).toBe('completed');
    if (result.type === 'completed') {
      expect(result.summary.created).toBe(1);
      expect(result.summary.recurrences).toBe(0);
    }
  });

  test('executeLintScan accepts injected detector runner', async () => {
    const db = testDb();
    let capturedPrompt = '';
    const result = await executeLintScan(
      db,
      { conversation: 'User: use strict', tokens: 10_000, turns: 10 },
      defaultConfig,
      (prompt) => {
        capturedPrompt = prompt;
        return Promise.resolve(emptyDetectorOutput);
      },
    );
    expect(result.type).toBe('completed');
    expect(capturedPrompt).toContain('use strict');
  });
});

describe('lint scan detector - recurrences', () => {
  test('executeLintScan records recurrences for matched entries', async () => {
    const db = testDb();
    const existing = seedEntry(db, { description: 'Agent ignores strict mode' });
    const result = await executeLintScan(
      db,
      { conversation: 'User: still no strict types', tokens: 10_000, turns: 10 },
      defaultConfig,
      () => Promise.resolve(buildRecurrenceOutput(existing.id)),
    );
    expect(result.type).toBe('completed');
    if (result.type === 'completed') {
      expect(result.summary.recurrences).toBe(1);
      expect(result.summary.created).toBe(0);
    }
  });
});

// ---- getLintListData ----

describe('lint list data', () => {
  test('getLintListData returns structured entry list', () => {
    const db = testDb();
    seedEntry(db, { description: 'Entry A', status: 'proposed' });
    seedEntry(db, { description: 'Entry B', status: 'accepted' });

    const result = getLintListData(db);
    expect(result.entries).toHaveLength(2);
    const descriptions = result.entries.map((e) => e.description);
    expect(descriptions).toContain('Entry A');
    expect(descriptions).toContain('Entry B');
  });

  test('getLintListData filters by status', () => {
    const db = testDb();
    seedEntry(db, { description: 'Entry A', status: 'proposed' });
    seedEntry(db, { description: 'Entry B', status: 'accepted' });

    const result = getLintListData(db, { status: 'accepted' });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.description).toBe('Entry B');
  });

  test('getLintListData returns empty array for no entries', () => {
    const db = testDb();
    const result = getLintListData(db);
    expect(result.entries).toHaveLength(0);
  });
});

// ---- getLintShowData ----

describe('lint show data', () => {
  test('getLintShowData returns entry with recurrences', () => {
    const db = testDb();
    const entry = seedEntry(db, { description: 'Test entry' });
    applyDetectorResult(db, parseDetectorResult(buildRecurrenceOutput(entry.id)));
    const result = getLintShowData(db, entry.id);
    expect(result).not.toBeNull();
    expect(result!.entry.id).toBe(entry.id);
    expect(result!.recurrences).toHaveLength(1);
  });

  test('getLintShowData resolves ID prefix', () => {
    const db = testDb();
    const entry = seedEntry(db, { description: 'Test entry' });
    const result = getLintShowData(db, entry.id.slice(0, 8));
    expect(result).not.toBeNull();
    expect(result!.entry.id).toBe(entry.id);
  });

  test('getLintShowData returns null for missing entry', () => {
    const db = testDb();
    expect(getLintShowData(db, 'nonexistent')).toBeNull();
  });
});

// ---- executeLintTransition ----

describe('lint transition orchestration', () => {
  test('executeLintTransition transitions from proposed to accepted', () => {
    const db = testDb();
    const entry = seedEntry(db, { status: 'proposed' });
    const result = executeLintTransition(db, entry.id, 'accepted');
    expect(result.from).toBe('proposed');
    expect(result.to).toBe('accepted');
    expect(result.id).toBe(entry.id);
  });

  test('executeLintTransition resolves ID prefix', () => {
    const db = testDb();
    const entry = seedEntry(db, { status: 'proposed' });
    const result = executeLintTransition(db, entry.id.slice(0, 8), 'deferred');
    expect(result.id).toBe(entry.id);
    expect(result.to).toBe('deferred');
  });

  test('executeLintTransition throws on invalid transition', () => {
    const db = testDb();
    const entry = seedEntry(db, { status: 'implemented' });
    expect(() => executeLintTransition(db, entry.id, 'proposed')).toThrow('Cannot transition');
  });

  test('executeLintTransition throws on missing entry', () => {
    const db = testDb();
    expect(() => executeLintTransition(db, 'nonexistent', 'accepted')).toThrow('not found');
  });
});

// ---- formatLintStatusText ----

describe('lint status formatting', () => {
  test('formatLintStatusText formats status model as text', () => {
    const db = testDb();
    seedEntry(db, { status: 'proposed' });
    seedEntry(db, { status: 'accepted' });

    const text = formatLintStatusText(buildLintStatusModel(db, defaultConfig));
    expect(text).toContain('Lint Observer Status:');
    expect(text).toContain('Proposed: 1');
    expect(text).toContain('Accepted: 1');
    expect(text).toContain('Total entries: 2');
    expect(text).toContain('Throttle: 1/');
  });
});

// ---- buildLintExportMarkdown ----

describe('lint export markdown', () => {
  test('buildLintExportMarkdown produces markdown for entries', () => {
    const db = testDb();
    seedEntry(db, { description: 'Export entry', severity: 'high', status: 'proposed' });
    const md = buildLintExportMarkdown(db);
    expect(md).toContain('# Lint Observer Export');
    expect(md).toContain('Export entry');
    expect(md).toContain('high');
    expect(md).toContain('proposed');
  });

  test('buildLintExportMarkdown returns empty message for no entries', () => {
    const db = testDb();
    expect(buildLintExportMarkdown(db)).toContain('No entries found.');
  });

  test('buildLintExportMarkdown throws for unsupported format', () => {
    const db = testDb();
    expect(() => buildLintExportMarkdown(db, { format: 'csv' })).toThrow(
      'Only markdown export is supported',
    );
  });
});

// ---- checkShouldScanLint ----

describe('lint scan gate checks', () => {
  test('checkShouldScanLint returns all gate results', () => {
    const result = checkShouldScanLint({
      activeCount: 0,
      config: defaultConfig,
      currentTokens: 10_000,
      currentTurns: 5,
      lastObservedTokens: 0,
      lastObservedTurns: 0,
    });

    expect(result.saturation.saturated).toBe(false);
    expect(result.tokenBudget.needed).toBe(true);
    expect(result.turnBudget.needed).toBe(false);
  });
});
