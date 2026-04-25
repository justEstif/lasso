import { describe, expect, test } from 'bun:test';

import { buildLassoArgs, piHostCapabilities } from '../src/adapters/pi/lasso.ts';

describe('Pi adapter lasso command mapping', () => {
  test('declares Pi host capabilities', () => {
    expect(piHostCapabilities).toEqual({
      compactionHooks: true,
      footerStatus: true,
      promptInjection: true,
      slashCommands: true,
    });
  });

  test('maps lifecycle hooks to lasso CLI commands', () => {
    expect(buildLassoArgs('lint-scan')).toEqual(['lint', 'scan']);
    expect(buildLassoArgs('lint-status')).toEqual(['lint', 'status']);
    expect(buildLassoArgs('memory-status')).toEqual(['memory', 'status']);
    expect(buildLassoArgs('memory-observe')).toEqual(['memory', 'observe']);
  });
});
