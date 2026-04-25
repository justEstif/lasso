import type { HarnessHostCapabilities } from '../contract.ts';

export const piHostCapabilities = {
  compactionHooks: true,
  footerStatus: true,
  promptInjection: true,
  slashCommands: true,
} satisfies HarnessHostCapabilities;

export interface LassoCommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export type PiLassoCommand =
  | 'lint-scan'
  | 'lint-status'
  | 'memory-observe'
  | 'memory-should-observe'
  | 'memory-status';

export interface RunLassoOptions {
  cwd?: string;
  input?: string;
}

export function buildLassoArgs(command: PiLassoCommand) {
  const commands = {
    'lint-scan': ['lint', 'scan'],
    'lint-status': ['lint', 'status'],
    'memory-observe': ['memory', 'observe'],
    'memory-should-observe': ['memory', 'should-observe'],
    'memory-status': ['memory', 'status'],
  } satisfies Record<PiLassoCommand, string[]>;

  return commands[command];
}

export async function runLasso(
  args: string[],
  options: RunLassoOptions = {},
): Promise<LassoCommandResult> {
  const child = Bun.spawn(['bun', 'run', 'index.ts', ...args], {
    cwd: options.cwd ?? process.cwd(),
    stderr: 'pipe',
    stdin: options.input ? 'pipe' : 'ignore',
    stdout: 'pipe',
  });

  if (options.input && child.stdin) {
    child.stdin.write(options.input);
    child.stdin.end();
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return { exitCode, stderr, stdout };
}
