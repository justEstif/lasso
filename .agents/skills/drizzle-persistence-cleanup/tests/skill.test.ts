import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const skillPath = path.join(import.meta.dir, '..', 'SKILL.md');
const evalPath = path.join(import.meta.dir, '..', 'evals', 'trigger-cases.json');
const skill = readFileSync(skillPath, 'utf8');

describe('drizzle-persistence-cleanup skill', () => {
  test('has resolver-facing frontmatter triggers', () => {
    expect(skill).toContain('name: drizzle-persistence-cleanup');
    expect(skill).toContain('why are we writing raw SQL');
    expect(skill).toContain('bun:sqlite exec is deprecated');
    expect(skill).toContain("I don't have Sentry");
  });

  test('documents Drizzle prepared statements and migration boundary', () => {
    expect(skill).toContain('.prepare()');
    expect(skill).toContain("sql.placeholder('id')");
    expect(skill).toContain('Raw SQL is isolated to migration files');
  });

  test('documents local logging replacement and verification', () => {
    expect(skill).toContain('bun remove @sentry/bun');
    expect(skill).toContain('console.error(message, ...details)');
    expect(skill).toContain('bun run lint');
    expect(skill).toContain('bun test');
  });

  test('trigger eval cases route to this skill', () => {
    const cases = JSON.parse(readFileSync(evalPath, 'utf8')) as Array<{
      expected_skill: string;
      input: string;
    }>;

    expect(cases).toHaveLength(3);
    for (const testCase of cases) {
      expect(testCase.expected_skill).toBe('drizzle-persistence-cleanup');
      expect(skill.toLowerCase()).toContain(testCase.input.toLowerCase().split(' ')[0] ?? '');
    }
  });
});
