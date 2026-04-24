import { describe, expect, test } from 'bun:test';

import packageJson from '../package.json';

const packageMetadata = packageJson as typeof packageJson & { private?: boolean };

describe('package distribution metadata', () => {
  test('publishes the scoped lasso CLI with required runtime files', () => {
    expect(packageJson.name).toBe('@justestif/lasso');
    expect(packageMetadata.private).toBeUndefined();
    expect(packageJson.bin.lasso).toBe('./index.ts');
    expect(packageJson.man).toContain('./man/lasso.1');
    expect(packageJson.files).toContain('drizzle');
    expect(packageJson.files).toContain('man');
    expect(packageJson.files).toContain('src');
  });
});
