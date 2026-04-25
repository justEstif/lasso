import { describe, expect, test } from 'bun:test';

import { parseObservationEntries, priorityEmoji } from '../src/observers/memory/parser.ts';

const emojiLogContent = [
  '## Project Preferences',
  '- 🔴 2025-04-25: User prefers Bun APIs over Node.js builtins',
  '- 🟡 2025-04-24: Project uses strict TypeScript configuration',
  '',
  '## Architecture',
  '- 🟢 2025-04-25: Considering migration to Drizzle ORM',
].join('\n');

describe('observation entry parser', () => {
  test('parses emoji-prioritized entries with categories', () => {
    const entries = parseObservationEntries(emojiLogContent);

    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      category: 'Project Preferences',
      content: 'User prefers Bun APIs over Node.js builtins',
      observedAt: '2025-04-25',
      priority: 'high',
    });
  });

  test('assigns medium and low priorities correctly', () => {
    const entries = parseObservationEntries(emojiLogContent);

    expect(entries[1]?.priority).toBe('medium');
    expect(entries[1]?.category).toBe('Project Preferences');
    expect(entries[2]?.priority).toBe('low');
    expect(entries[2]?.category).toBe('Architecture');
  });
});

describe('bracket priority parser', () => {
  test('parses structured event log with bracket priorities', () => {
    const content = [
      '## Setup',
      '- [high] 2025-03-10: Critical database migration needed',
      '- [medium] 2025-03-11: Standard config update',
      '- [low] 2025-03-12: Optional cleanup task',
    ].join('\n');

    const entries = parseObservationEntries(content);

    expect(entries).toHaveLength(3);
    expect(entries[0]?.priority).toBe('high');
    expect(entries[1]?.priority).toBe('medium');
    expect(entries[2]?.priority).toBe('low');
  });
});

describe('plain text fallback', () => {
  test('falls back to single entry for plain text', () => {
    const entries = parseObservationEntries('User prefers direct Bun APIs for file writes.');

    expect(entries).toHaveLength(1);
    expect(entries[0]?.priority).toBe('medium');
    expect(entries[0]?.category).toBe('');
    expect(entries[0]?.content).toBe('User prefers direct Bun APIs for file writes.');
  });
});

describe('noise filtering', () => {
  test('skips empty lines and non-matching text', () => {
    const content = [
      '## Valid Category',
      '- 🔴 2025-04-25: Important observation',
      '',
      'This is just a paragraph of text.',
      '- Missing date and priority',
    ].join('\n');

    const entries = parseObservationEntries(content);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.content).toBe('Important observation');
  });
});

describe('priority emoji helper', () => {
  test('maps priority levels to correct emoji', () => {
    expect(priorityEmoji('high')).toBe('🔴');
    expect(priorityEmoji('medium')).toBe('🟡');
    expect(priorityEmoji('low')).toBe('🟢');
  });
});
