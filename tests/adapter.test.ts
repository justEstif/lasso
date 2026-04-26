import { describe, expect, test } from 'bun:test';

import { buildClaudeLassoArgs, claudeHostCapabilities } from '../src/adapters/claude/lasso.ts';
import {
  buildOpencodeLassoArgs,
  opencodeHostCapabilities,
} from '../src/adapters/opencode/lasso.ts';
import { buildLassoArgs, piHostCapabilities } from '../src/adapters/pi/lasso.ts';

describe('adapter host capabilities', () => {
  test('Pi has full capabilities', () => {
    expect(piHostCapabilities).toEqual({
      compactionHooks: true,
      footerStatus: true,
      promptInjection: true,
      slashCommands: true,
    });
  });

  test('opencode has prompt injection, compaction, and slash commands', () => {
    expect(opencodeHostCapabilities).toEqual({
      compactionHooks: true,
      footerStatus: false,
      promptInjection: true,
      slashCommands: true,
    });
  });

  test('Claude Code has prompt injection and compaction but no footer or slash commands', () => {
    expect(claudeHostCapabilities).toEqual({
      compactionHooks: true,
      footerStatus: false,
      promptInjection: true,
      slashCommands: false,
    });
  });
});

describe('adapter command mapping', () => {
  test('Pi maps lifecycle hooks to lasso CLI commands', () => {
    expect(buildLassoArgs('lint-scan')).toEqual(['lint', 'scan']);
    expect(buildLassoArgs('lint-status')).toEqual(['lint', 'status']);
    expect(buildLassoArgs('memory-status')).toEqual(['memory', 'status']);
    expect(buildLassoArgs('memory-observe')).toEqual(['memory', 'observe']);
  });

  test('opencode maps all lifecycle commands', () => {
    expect(buildOpencodeLassoArgs('lint-scan')).toEqual(['lint', 'scan']);
    expect(buildOpencodeLassoArgs('memory-context')).toEqual(['memory', 'context']);
    expect(buildOpencodeLassoArgs('memory-observe')).toEqual(['memory', 'observe']);
    expect(buildOpencodeLassoArgs('memory-reflect')).toEqual(['memory', 'reflect']);
    expect(buildOpencodeLassoArgs('memory-should-observe')).toEqual(['memory', 'should-observe']);
    expect(buildOpencodeLassoArgs('memory-should-reflect')).toEqual(['memory', 'should-reflect']);
    expect(buildOpencodeLassoArgs('memory-working')).toEqual(['memory', 'working']);
  });

  test('Claude Code maps all lifecycle commands', () => {
    expect(buildClaudeLassoArgs('lint-scan')).toEqual(['lint', 'scan']);
    expect(buildClaudeLassoArgs('memory-context')).toEqual(['memory', 'context']);
    expect(buildClaudeLassoArgs('memory-observe')).toEqual(['memory', 'observe']);
    expect(buildClaudeLassoArgs('memory-reflect')).toEqual(['memory', 'reflect']);
    expect(buildClaudeLassoArgs('memory-should-observe')).toEqual(['memory', 'should-observe']);
    expect(buildClaudeLassoArgs('memory-should-reflect')).toEqual(['memory', 'should-reflect']);
    expect(buildClaudeLassoArgs('memory-working')).toEqual(['memory', 'working']);
  });
});
