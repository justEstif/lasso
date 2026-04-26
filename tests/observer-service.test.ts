import { describe, expect, test } from 'bun:test';

import { defaultConfig } from '../src/config/load.ts';
import { checkShouldScanLint } from '../src/observers/lint/commands.ts';
import {
  checkSaturation,
  checkTokenBudget,
  checkTurnBudget,
  runObserverLifecycle,
} from '../src/observers/service.ts';

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

describe('shared observer skipped lifecycle', () => {
  test('skips observation without advancing progress when token gate is closed', async () => {
    let observed = false;
    let persisted = 0;

    const result = await runObserverLifecycle({
      gates: {
        tokenBudget: checkTokenBudget({
          currentTokens: 5000,
          lastObservedTokens: 4000,
          thresholdTokens: 10_000,
        }),
      },
      observe: () => {
        observed = true;
        return 'observed';
      },
      persistProgress: () => {
        persisted++;
      },
    });

    expect(result.skipped).toBe(true);
    expect(observed).toBe(false);
    expect(persisted).toBe(0);
  });
});

describe('shared observer active lifecycle', () => {
  test('runs observation and persists progress when token gate is open', async () => {
    let persistedTokens = 0;
    let persistedTurns = 0;

    const result = await runObserverLifecycle({
      gates: {
        tokenBudget: checkTokenBudget({
          currentTokens: 15_000,
          lastObservedTokens: 4000,
          thresholdTokens: 10_000,
        }),
        turnBudget: checkTurnBudget({ currentTurns: 12, lastObservedTurns: 1, thresholdTurns: 10 }),
      },
      observe: () => 'observed',
      persistProgress: (progress) => {
        persistedTokens = progress.observedTokens;
        persistedTurns = progress.observedTurns ?? 0;
      },
    });

    expect(result.skipped).toBe(false);
    expect(result.skipped ? undefined : result.result).toBe('observed');
    expect(persistedTokens).toBe(15_000);
    expect(persistedTurns).toBe(12);
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
    const result = checkShouldScanLint({
      activeCount: 15,
      config: defaultConfig,
      currentTokens: 5000,
      currentTurns: 10,
      lastObservedTokens: 0,
      lastObservedTurns: 0,
    });

    expect(result.saturation.saturated).toBe(true);
    expect(result.tokenBudget.needed).toBe(true);
    expect(result.turnBudget.needed).toBe(true);
  });
});
