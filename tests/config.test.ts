import { describe, expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadConfig } from '../src/config/load';

describe('Config loading', () => {
  const tmpDir = path.join(process.cwd(), 'tests', '.tmp_test_config');

  test('loads default config when no files exist', async () => {
    const config = await loadConfig(tmpDir);
    expect(config.observers.lint.enabled).toBe(true);
    expect(config.observers.lint.scanThresholdTokens).toBe(5000);
    expect(config.observers.memory.enabled).toBe(true);
  });

  test('merges project config over defaults', async () => {
    await rm(tmpDir, { force: true, recursive: true });
    const lassoDir = path.join(tmpDir, '.lasso');
    await mkdir(lassoDir, { recursive: true });

    await writeFile(
      path.join(lassoDir, 'config.json'),
      JSON.stringify({
        observers: {
          lint: {
            enabled: false,
            scanThresholdTokens: 1000,
          },
        },
      }),
    );

    const config = await loadConfig(tmpDir);
    expect(config.observers.lint.enabled).toBe(false);
    expect(config.observers.lint.scanThresholdTokens).toBe(1000);
    expect(config.observers.lint.scanThresholdTurns).toBe(10); // from default
    expect(config.observers.memory.enabled).toBe(true); // from default

    await rm(tmpDir, { force: true, recursive: true });
  });
});
