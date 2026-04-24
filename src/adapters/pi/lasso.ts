export interface LassoCommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export interface RunLassoOptions {
  cwd?: string;
  input?: string;
}

export function buildLassoArgs(command: 'lint-status' | 'memory-observe' | 'memory-status') {
  const commands = {
    'lint-status': ['lint', 'status'],
    'memory-observe': ['memory', 'observe', '--content'],
    'memory-status': ['memory', 'status'],
  } satisfies Record<typeof command, string[]>;

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
