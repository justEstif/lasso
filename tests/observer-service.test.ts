import { describe, expect, test } from 'bun:test';

import { defaultConfig } from '../src/config/load.ts';
import { checkShouldScanLint } from '../src/observers/lint/commands.ts';
import { checkSaturation, checkTokenBudget } from '../src/observers/service.ts';

describe('shared observer token budget gate', () => {
  test('checks token-budget thresholds consistently', () => {
    expect(
      checkTokenBudget({
        currentTokens: 15_000,
        lastObservedTokens: 4000,
        thresholdTokens: 10_000,
      }),
    ).toEqual({
      currentTokens: 15_000,
      lastObserved: 4000,
      needed: true,
      threshold: 10_000,
      unobserved: 11_000,
    });

    expect(
      checkTokenBudget({ currentTokens: 9000, lastObservedTokens: 4000, thresholdTokens: 10_000 })
        .needed,
    ).toBe(false);
  });

  test('clamps token regressions so callers do not handle negative deltas', () => {
    expect(
      checkTokenBudget({ currentTokens: 2000, lastObservedTokens: 4000, thresholdTokens: 1000 }),
    ).toEqual({
      currentTokens: 2000,
      lastObserved: 4000,
      needed: false,
      threshold: 1000,
      unobserved: 0,
    });
  });
});

describe('shared observer saturation gate', () => {
  test('checks saturation at the shared observer boundary', () => {
    expect(checkSaturation({ activeCount: 14, limit: 15 })).toEqual({
      activeCount: 14,
      limit: 15,
      saturated: false,
    });

    expect(checkSaturation({ activeCount: 15, limit: 15 }).saturated).toBe(true);
  });

  test('exposes lint scan gating through the shared primitives', () => {
    const result = checkShouldScanLint(15, 5000, defaultConfig);

    expect(result.saturation.saturated).toBe(true);
    expect(result.tokenBudget.needed).toBe(true);
  });
});
