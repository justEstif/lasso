import type { LassoConfig } from '../../config/load.ts';
import type { LassoDb } from '../../db/index.ts';

import { checkShouldReflect } from './db.ts';
import {
  checkShouldObserve,
  executeMemoryObserve,
  executeMemoryReflect,
  executeWorkingMemoryAction,
  getMemoryContextText,
  getMemoryExportText,
  getMemoryStatusText,
  type MemoryContextOptions,
  type MemoryExportOptions,
  type MemoryObserveOptions,
  type MemoryReflectOptions,
  type MemoryWorkingOptions,
} from './orchestration.ts';
import { estimateTokens } from './tokens.ts';

// ---------------------------------------------------------------------------
// Thin CLI wrappers
// ---------------------------------------------------------------------------

export async function handleMemoryContext(db: LassoDb, options: MemoryContextOptions) {
  console.log(getMemoryContextText(db, options));
}

export function handleMemoryExport(db: LassoDb, options: MemoryExportOptions = {}) {
  console.log(getMemoryExportText(db, options));
}

export async function handleMemoryObserve(
  db: LassoDb,
  options: MemoryObserveOptions,
  config: LassoConfig,
) {
  const content = await readMemoryContent(options);
  if (content.trim().length === 0) {
    console.error('memory observe needs --content <text>, --input <path>, or stdin content.');
    process.exit(1);
  }

  const scope = options.scope ?? config.observers.memory.scope;
  const observedTokens = options.tokens ? Number(options.tokens) : estimateTokens(content);

  const observation = await executeMemoryObserve(
    db,
    { content, force: options.force, observedTokens, scope },
    config,
  );

  if (observation.skipped) {
    console.log(JSON.stringify({ skipped: true, tokenBudget: observation.gates.tokenBudget }));
    return;
  }

  console.log(
    `Memory snapshot ${observation.result.snapshotId} created with ${observation.result.entries.length} entries (${observation.result.scope}).`,
  );
}

export async function handleMemoryReflect(db: LassoDb, options: MemoryReflectOptions) {
  const content = await readMemoryContent(options);
  if (content.trim().length === 0) {
    console.error('memory reflect needs --content <text>, --input <path>, or stdin content.');
    process.exit(1);
  }

  const { reflection, sourceSnapshotCount } = executeMemoryReflect(
    db,
    content,
    Number(options.limit ?? 20),
  );
  console.log(`Memory reflection ${reflection.id} created from ${sourceSnapshotCount} snapshots.`);
}

export function handleMemoryShouldObserve(db: LassoDb, currentTokens: number, config: LassoConfig) {
  const result = checkShouldObserve(db, currentTokens, config);
  console.log(JSON.stringify(result));
  process.exit(result.needed ? 0 : 1);
}

export function handleMemoryShouldReflect(db: LassoDb, config: LassoConfig) {
  const scope = config.observers.memory.scope;
  const threshold = config.observers.memory.reflectionThreshold;
  const result = checkShouldReflect(db, scope, threshold);
  console.log(JSON.stringify(result));
  process.exit(result.needed ? 0 : 1);
}

export function handleMemoryStatus(db: LassoDb) {
  console.log(getMemoryStatusText(db));
}

export function handleMemoryWorking(db: LassoDb, options: MemoryWorkingOptions) {
  const result = executeWorkingMemoryAction(db, options);
  console.log(result.text);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function readMemoryContent(options: MemoryObserveOptions | MemoryReflectOptions) {
  if (options.content) return options.content;
  if (options.input) return Bun.file(options.input).text();
  return Bun.stdin.text();
}
