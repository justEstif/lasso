import { describe, expect, test } from 'bun:test';

import type { LintEntry } from '../src/observers/lint/db.ts';

import { buildLintDetectorPrompt, LINT_DETECTOR_VERSION } from '../src/observers/lint/prompt.ts';

function entry(overrides: Partial<LintEntry> = {}): LintEntry {
  return {
    affected_paths: ['src/app/page.tsx'],
    category: 'framework-migration',
    created_at: '2026-04-24T00:00:00.000Z',
    description: 'Avoid antd imports in migrated pages',
    detector_version: LINT_DETECTOR_VERSION,
    id: 'entry-1',
    proposed_form: 'no-restricted-imports antd',
    referenced_date: null,
    relative_offset: null,
    severity: 'high',
    source_excerpt: 'stop using antd here',
    status: 'proposed',
    updated_at: '2026-04-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('lint detector prompt', () => {
  test('includes rubric, active entries, and conversation', () => {
    const prompt = buildLintDetectorPrompt('User: stop using antd here', [entry()]);

    expect(prompt).toContain(`Detector version: ${LINT_DETECTOR_VERSION}`);
    expect(prompt).toContain('one-off task instructions');
    expect(prompt).toContain('entry-1');
    expect(prompt).toContain('framework-migration');
    expect(prompt).toContain('affected_paths');
    expect(prompt).toContain('User: stop using antd here');
  });

  test('shows empty dedup context clearly', () => {
    const prompt = buildLintDetectorPrompt('User: we always sort imports', []);

    expect(prompt).toContain('No active entries.');
  });
});
