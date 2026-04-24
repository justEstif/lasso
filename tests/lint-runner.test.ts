import { describe, expect, test } from 'bun:test';

import { runDetector } from '../src/observers/lint/runner.ts';

describe('lint detector runner', () => {
  test('passes prompt to detector command stdin and returns stdout', async () => {
    const output = await runDetector({
      command:
        'node -e "process.stdin.on(\'data\', d => process.stdout.write(String(d).toUpperCase()))"',
      prompt: 'hello detector',
    });

    expect(output).toBe('HELLO DETECTOR');
  });

  test('fails clearly when no command is configured', async () => {
    await expect(runDetector({ prompt: 'hello' })).rejects.toThrow(
      'No lint detector runner configured',
    );
  });

  test('includes stderr when detector command fails', async () => {
    await expect(
      runDetector({
        command: 'echo detector failed >&2; exit 7',
        prompt: 'hello',
      }),
    ).rejects.toThrow('detector failed');
  });
});
