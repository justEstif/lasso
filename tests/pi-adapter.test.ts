import { describe, expect, test } from 'bun:test';

import { buildLassoArgs } from '../src/adapters/pi/lasso.ts';

describe('Pi adapter lasso command mapping', () => {
  test('maps lifecycle hooks to lasso CLI commands', () => {
    expect(buildLassoArgs('lint-status')).toEqual(['lint', 'status']);
    expect(buildLassoArgs('memory-status')).toEqual(['memory', 'status']);
    expect(buildLassoArgs('memory-observe')).toEqual(['memory', 'observe', '--content']);
  });
});
