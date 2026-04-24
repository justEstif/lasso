import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

async function runLasso(args: string[]) {
  const child = Bun.spawn(['bun', 'run', 'index.ts', ...args], {
    cwd: process.cwd(),
    stderr: 'pipe',
    stdout: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return { exitCode, stderr, stdout };
}

export default function (pi: ExtensionAPI) {
  pi.on('session_start', async (_event, ctx) => {
    const result = await runLasso(['memory', 'status']);
    if (result.exitCode === 0) ctx.ui.setStatus('lasso', 'lasso memory ready');
  });

  pi.on('turn_end', async (_event, ctx) => {
    const result = await runLasso(['lint', 'status']);
    ctx.ui.setStatus('lasso', result.exitCode === 0 ? 'lasso lint checked' : 'lasso check failed');
  });

  pi.registerCommand('lasso-status', {
    description: 'Show lasso lint and memory status',
    handler: async (_args, ctx) => {
      const lint = await runLasso(['lint', 'status']);
      const memory = await runLasso(['memory', 'status']);
      ctx.ui.notify(`${lint.stdout}\n${memory.stdout}`.trim(), lint.exitCode || memory.exitCode ? 'error' : 'info');
    },
  });
}
