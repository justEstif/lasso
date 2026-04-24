export interface DetectorRunnerOptions {
  command?: string;
  prompt: string;
}

export async function runDetector(options: DetectorRunnerOptions): Promise<string> {
  if (!options.command) {
    throw new Error(
      'No lint detector runner configured. Use --detector-output <path>, --detector-command <command>, or set observers.lint.detectorCommand in .lasso/config.json.',
    );
  }

  const child = Bun.spawn(['sh', '-c', options.command], {
    stderr: 'pipe',
    stdin: 'pipe',
    stdout: 'pipe',
  });

  child.stdin.write(options.prompt);
  child.stdin.end();

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Lint detector command failed with exit ${exitCode}: ${stderr.trim()}`);
  }

  return stdout;
}
