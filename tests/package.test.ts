import { describe, expect, test } from 'bun:test';

import packageJson from '../package.json';

describe('package distribution metadata', () => {
  test('publishes the scoped lasso CLI with required runtime files', () => {
    expect(packageJson.name).toBe('@justestif/lasso');
    expect(packageJson.private).toBeUndefined();
    expect(packageJson.bin.lasso).toBe('./index.ts');
    expect(packageJson.files).toContain('drizzle');
    expect(packageJson.files).toContain('src');
  });
});
