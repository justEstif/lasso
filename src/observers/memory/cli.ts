import { Command } from 'commander';

import type { loadConfig } from '../../config/load.ts';
import type { LassoDb } from '../../db/index.ts';

import {
  handleMemoryContext,
  handleMemoryExport,
  handleMemoryObserve,
  handleMemoryReflect,
  handleMemoryShouldObserve,
  handleMemoryShouldReflect,
  handleMemoryStatus,
  handleMemoryWorking,
} from './commands.ts';

export function registerMemoryCli(
  program: Command,
  db: LassoDb,
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  const memoryCmd = program.command('memory').description('Memory observer commands');

  memoryCmd
    .command('status')
    .description('Show current memory state')
    .action(() => handleMemoryStatus(db));

  memoryCmd
    .command('observe')
    .description('Record a memory observation snapshot')
    .option('--content <text>', 'Observation content')
    .option('--input <path>', 'Observation content file')
    .option('--scope <scope>', 'Memory scope: thread or resource')
    .option('--tokens <count>', 'Estimated token count of the observed conversation')
    .option('--force', 'Observe even when the token threshold is not met')
    .action((opts) => handleMemoryObserve(db, opts, config));

  registerReflectAndContext(memoryCmd, db);
  registerCheckCommands(memoryCmd, db, config);
  registerWorkingCommand(memoryCmd, db);

  memoryCmd
    .command('export')
    .description('Export memory observations and reflections to markdown')
    .option('--priority <level>', 'Filter by priority: high, medium, low')
    .option('--after <date>', 'Show entries observed on or after date (YYYY-MM-DD)')
    .option('--before <date>', 'Show entries observed on or before date (YYYY-MM-DD)')
    .action((opts) => handleMemoryExport(db, opts));
}

async function readStdinContent(): Promise<string | undefined> {
  if (process.stdin.isTTY) return undefined;
  return Bun.stdin.text();
}

function registerCheckCommands(
  memoryCmd: Command,
  db: LassoDb,
  config: Awaited<ReturnType<typeof loadConfig>>,
) {
  memoryCmd
    .command('should-observe')
    .description('Check if memory observation is needed based on token budget')
    .requiredOption('--tokens <count>', 'Current estimated token count of the conversation')
    .action((opts) => handleMemoryShouldObserve(db, Number(opts.tokens), config));

  memoryCmd
    .command('should-reflect')
    .description('Check if memory reflection is needed based on token budget')
    .action(() => handleMemoryShouldReflect(db, config));
}

function registerReflectAndContext(memoryCmd: Command, db: LassoDb) {
  memoryCmd
    .command('reflect')
    .description('Record a consolidated memory reflection')
    .option('--content <text>', 'Reflection content')
    .option('--input <path>', 'Reflection content file')
    .option('--limit <count>', 'Number of recent snapshots to mark as sources', '20')
    .action((opts) => handleMemoryReflect(db, opts));

  memoryCmd
    .command('context')
    .description('Show focused memory context, optionally ranked by query')
    .option('--query <text>', 'Query used to rank relevant memory')
    .option('--limit <count>', 'Maximum number of memory items', '10')
    .option('--priority <level>', 'Filter by priority: high, medium, low')
    .option('--after <date>', 'Show entries observed on or after date (YYYY-MM-DD)')
    .option('--before <date>', 'Show entries observed on or before date (YYYY-MM-DD)')
    .option(
      '--sort <field:order>',
      'Sort entries by field:order — field is observed_at|created_at|referenced_date, order is asc|desc',
    )
    .action((opts) => handleMemoryContext(db, opts));
}

function registerWorkingCommand(memoryCmd: Command, db: LassoDb) {
  memoryCmd
    .command('working')
    .description('View or manage working memory scratchpad')
    .option('--init', 'Initialize working memory with a default template')
    .option('--edit', 'Update working memory content from stdin')
    .option('--reset', 'Reset working memory to the default template')
    .option('--resource-id <id>', 'Scope working memory to a specific resource')
    .option('--thread-id <id>', 'Scope working memory to a specific thread')
    .action(async (opts) => {
      const stdin = opts.edit ? await readStdinContent() : undefined;
      handleMemoryWorking(db, { ...opts, stdin });
    });
}
