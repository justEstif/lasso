import type { Model } from '@mariozechner/pi-ai';
import { completeSimple } from '@mariozechner/pi-ai';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { convertToLlm, serializeConversation } from '@mariozechner/pi-coding-agent';

interface LassoCommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

interface RunLassoOptions {
  input?: string;
}

async function runLasso(args: string[], options: RunLassoOptions = {}): Promise<LassoCommandResult> {
  const child = Bun.spawn(['lasso', ...args], {
    cwd: process.cwd(),
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

interface LassoCompactionEvent {
  preparation: {
    firstKeptEntryId: string;
    messagesToSummarize: unknown[];
    previousSummary?: string;
    tokensBefore: number;
    turnPrefixMessages: unknown[];
  };
  signal?: AbortSignal;
}

interface LassoStatusContext {
  model?: Model<any>;
  modelRegistry?: {
    getApiKeyAndHeaders(model: Model<any>): Promise<{ apiKey?: string; error?: string; headers?: Record<string, string>; ok: boolean }>;
    getAll(): Model<any>[];
    hasConfiguredAuth(model: Model<any>): boolean;
  };
  sessionManager?: {
    getBranch(): Array<{ type: string; message?: unknown }>;
  };
  signal?: AbortSignal;
  ui: {
    notify(message: string, level?: string): void;
    setStatus(id: string, text: string | undefined): void;
  };
}

function serializePiConversation(ctx: LassoStatusContext) {
  const branch = ctx.sessionManager?.getBranch?.() ?? [];
  const messages = branch
    .filter((entry) => entry.type === 'message' && entry.message)
    .map((entry) => entry.message);

  return serializeConversation(convertToLlm(messages));
}

function updateLassoStatus(ctx: LassoStatusContext) {
  void Promise.all([runLasso(['lint', 'status']), runLasso(['memory', 'status'])])
    .then(([lint, memory]) => {
      const lintSummary = summarizeLintStatus(lint.stdout);
      const memorySummary = summarizeMemoryStatus(memory.stdout);
      const failed = lint.exitCode !== 0 || memory.exitCode !== 0;
      ctx.ui.setStatus(
        'lasso',
        failed ? '[lasso: observer status unavailable]' : `[lasso: ${lintSummary}, ${memorySummary}]`,
      );
    })
    .catch(() => {
      ctx.ui.setStatus('lasso', '[lasso: unavailable]');
    });
}

function summarizeLintStatus(stdout: string) {
  const proposed = stdout.match(/- Proposed: (\d+)/)?.[1] ?? '?';
  return `lint ${proposed} pending`;
}

function summarizeMemoryStatus(stdout: string) {
  const snapshots = stdout.match(/- Snapshots: (\d+)/)?.[1] ?? '?';
  return `memory ${snapshots} snapshots`;
}

function buildMemoryObserverPrompt(conversation: string) {
  return `Extract durable memory from this agent conversation. Return JSON with keys summary, currentTask, and suggestedResponse. Keep only useful project facts, decisions, corrections, and continuation state.\n\n<conversation>\n${conversation}\n</conversation>`;
}

function buildMemoryReflectorPrompt(event: LassoCompactionEvent) {
  const { messagesToSummarize, previousSummary, turnPrefixMessages } = event.preparation;
  const conversation = serializeConversation(convertToLlm([...messagesToSummarize, ...turnPrefixMessages]));
  const previous = previousSummary ? `\n\nPrevious summary:\n${previousSummary}` : '';

  return `Create a compaction-ready memory summary for this agent session.${previous}\n\nInclude goals, decisions, important technical details, current state, blockers, and next steps. Return JSON with keys threadSummary and resourceSummary.\n\n<conversation>\n${conversation}\n</conversation>`;
}

function chooseModel(ctx: LassoStatusContext) {
  const configured = ctx.modelRegistry?.getAll?.().filter((model) => ctx.modelRegistry?.hasConfiguredAuth(model)) ?? [];
  if (ctx.model && configured.some((model) => model.provider === ctx.model?.provider && model.id === ctx.model?.id)) {
    return ctx.model;
  }
  return configured[0] ?? ctx.model;
}

function extractRawText(response: any) {
  const chunks: string[] = [];
  const content = Array.isArray(response?.content) ? response.content : [];
  for (const part of content) {
    if (typeof part?.text === 'string') chunks.push(part.text);
    if (typeof part?.content === 'string') chunks.push(part.content);
  }
  if (typeof response?.text === 'string') chunks.push(response.text);
  if (typeof response?.content === 'string') chunks.push(response.content);
  return chunks.join('\n').trim();
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced || text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function runPiMemoryModel(ctx: LassoStatusContext, prompt: string, signal?: AbortSignal) {
  const model = chooseModel(ctx);
  if (!model || !ctx.modelRegistry) throw new Error('No Pi model available for lasso memory');
  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok || !auth.apiKey) throw new Error(auth.error || `No auth for ${model.provider}/${model.id}`);

  const response = await completeSimple(
    model,
    {
      messages: [
        {
          content: [{ text: prompt, type: 'text' }],
          role: 'user',
          timestamp: Date.now(),
        },
      ],
    },
    { apiKey: auth.apiKey, headers: auth.headers, maxTokens: 4096, signal: signal ?? ctx.signal },
  );

  const rawText = extractRawText(response);
  return { parsed: extractJsonObject(rawText), rawText };
}

async function persistMemoryObservation(ctx: LassoStatusContext, conversation: string) {
  const result = await runPiMemoryModel(ctx, buildMemoryObserverPrompt(conversation));
  const summary = typeof result.parsed?.summary === 'string' ? result.parsed.summary : result.rawText;
  if (summary.trim()) await runLasso(['memory', 'observe'], { input: summary.trim() });
}

async function observeWithLasso(ctx: LassoStatusContext) {
  const conversation = serializePiConversation(ctx).trim();
  if (!conversation) {
    updateLassoStatus(ctx);
    return;
  }

  ctx.ui.setStatus('lasso', '[lasso: observing...]');
  void Promise.all([runLasso(['lint', 'scan'], { input: conversation }), persistMemoryObservation(ctx, conversation)])
    .then(() => updateLassoStatus(ctx))
    .catch((error) => {
      ctx.ui.notify(`lasso observation failed: ${error instanceof Error ? error.message : String(error)}`, 'warning');
      updateLassoStatus(ctx);
    });
}

function parseLassoCommand(args: string) {
  return args
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((part) => part.split(':').filter(Boolean));
}

async function runMirroredCommand(args: string, ctx: LassoStatusContext) {
  const commandArgs = parseLassoCommand(args);
  if (commandArgs.length === 0) {
    const lint = await runLasso(['lint', 'status']);
    const memory = await runLasso(['memory', 'status']);
    ctx.ui.notify(`${lint.stdout}\n${memory.stdout}`.trim(), lint.exitCode || memory.exitCode ? 'error' : 'info');
    return;
  }

  const result = await runLasso(commandArgs);
  ctx.ui.notify((result.stdout || result.stderr).trim(), result.exitCode === 0 ? 'info' : 'error');
  updateLassoStatus(ctx);
}

export default function (pi: ExtensionAPI) {
  pi.on('session_start', (_event, ctx) => {
    updateLassoStatus(ctx);
  });

  pi.on('before_agent_start', async (event) => {
    const memory = await runLasso(['memory', 'export']);
    if (memory.exitCode !== 0 || !memory.stdout.trim()) return;

    return {
      systemPrompt: `=== LASSO MEMORY ===\n${memory.stdout.trim()}\n====================\n\n${event.systemPrompt}`,
    };
  });

  pi.on('turn_end', (_event, ctx) => {
    observeWithLasso(ctx);
  });

  pi.on('session_before_compact', async (event, ctx) => {
    ctx.ui.setStatus('lasso', '[lasso: reflecting...]');
    try {
      const result = await runPiMemoryModel(ctx, buildMemoryReflectorPrompt(event), event.signal);
      const summary = typeof result.parsed?.threadSummary === 'string' ? result.parsed.threadSummary : result.rawText;
      if (!summary.trim()) return;

      await runLasso(['memory', 'reflect'], { input: summary.trim() });

      return {
        compaction: {
          firstKeptEntryId: event.preparation.firstKeptEntryId,
          summary: summary.trim(),
          tokensBefore: event.preparation.tokensBefore,
        },
      };
    } finally {
      ctx.ui.setStatus('lasso', undefined);
    }
  });

  pi.registerCommand('lasso', {
    description: 'Run a mirrored lasso command, e.g. /lasso lint:list or /lasso memory:status',
    handler: async (args, ctx) => {
      await runMirroredCommand(args, ctx);
    },
  });

  pi.registerCommand('lasso:lint:scan', {
    description: 'Run lasso lint scan on the current Pi conversation',
    handler: async (_args, ctx) => {
      const conversation = serializePiConversation(ctx);
      const result = await runLasso(['lint', 'scan'], { input: conversation });
      ctx.ui.notify((result.stdout || result.stderr).trim(), result.exitCode === 0 ? 'info' : 'error');
      updateLassoStatus(ctx);
    },
  });

  pi.registerCommand('lasso:lint:list', {
    description: 'List lasso lint entries',
    handler: async (args, ctx) => {
      await runMirroredCommand(`lint:list ${args}`, ctx);
    },
  });

  pi.registerCommand('lasso:lint:status', {
    description: 'Show lasso lint status',
    handler: async (args, ctx) => {
      await runMirroredCommand(`lint:status ${args}`, ctx);
    },
  });

  pi.registerCommand('lasso:memory:observe', {
    description: 'Run lasso memory observe on the current Pi conversation',
    handler: async (_args, ctx) => {
      const conversation = serializePiConversation(ctx);
      const result = await runLasso(['memory', 'observe'], { input: conversation });
      ctx.ui.notify((result.stdout || result.stderr).trim(), result.exitCode === 0 ? 'info' : 'error');
      updateLassoStatus(ctx);
    },
  });

  pi.registerCommand('lasso:memory:status', {
    description: 'Show lasso memory status',
    handler: async (args, ctx) => {
      await runMirroredCommand(`memory:status ${args}`, ctx);
    },
  });

  pi.registerCommand('lasso:memory:reflect', {
    description: 'Run lasso memory reflect',
    handler: async (args, ctx) => {
      await runMirroredCommand(`memory:reflect ${args}`, ctx);
    },
  });

  pi.registerCommand('lasso-status', {
    description: 'Show lasso lint and memory status',
    handler: async (_args, ctx) => {
      await runMirroredCommand('', ctx);
    },
  });
}
