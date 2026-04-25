import { Database } from 'bun:sqlite';

import type { LassoConfig } from '../../config/load.ts';

import {
  countReflections,
  countSnapshots,
  createReflection,
  createSnapshot,
  getObservationState,
  listReflections,
  listSnapshots,
  parseSourceSnapshotIds,
  recordObservationTokenCount,
  searchSnapshots,
} from './db.ts';
import { tokenSimilarity } from './fingerprint.ts';
import { estimateTokens } from './tokens.ts';

export interface ShouldObserveResult {
  currentTokens: number;
  lastObserved: number;
  needed: boolean;
  threshold: number;
  unobserved: number;
}

export interface ShouldObserveResult {
  currentTokens: number;
  lastObserved: number;
  needed: boolean;
  threshold: number;
  unobserved: number;
}

interface MemoryContextOptions {
  limit?: string;
  query?: string;
}

interface MemoryObserveOptions {
  content?: string;
  input?: string;
  scope?: 'resource' | 'thread';
  tokens?: string;
}

interface MemoryReflectOptions {
  content?: string;
  input?: string;
  limit?: string;
}

export function checkShouldObserve(
  db: Database,
  currentTokens: number,
  config: LassoConfig,
): ShouldObserveResult {
  const scope = config.observers.memory.scope;
  const threshold = config.observers.memory.observationThreshold;
  const lastObserved = getObservationState(db, scope);
  const unobserved = currentTokens - lastObserved;
  const needed = unobserved >= threshold;

  return { currentTokens, lastObserved, needed, threshold, unobserved };
}

export function handleMemoryContext(db: Database, options: MemoryContextOptions) {
  const snapshots = options.query
    ? searchSnapshots(db, options.query, Number(options.limit ?? 5))
    : listSnapshots(db, Number(options.limit ?? 5));

  console.log('# Lasso Memory Context\n');
  if (snapshots.length === 0) console.log('No relevant memory found.');
  for (const snapshot of snapshots) {
    console.log(`- ${snapshot.content}`);
  }
}

export function handleMemoryExport(db: Database) {
  const snapshots = distinctSnapshots(listSnapshots(db, 100)).slice(0, 5);
  const reflections = listReflections(db, 100);

  console.log('# Memory Observer Export\n');
  console.log('## Reflections\n');
  if (reflections.length === 0) console.log('No reflections found.\n');
  for (const reflection of reflections) {
    console.log(`### ${reflection.id}`);
    console.log(`**Created:** ${reflection.created_at}`);
    console.log(`**Sources:** ${parseSourceSnapshotIds(reflection).join(', ') || 'none'}\n`);
    console.log(`${reflection.consolidated_content}\n`);
  }

  console.log('## Snapshots\n');
  if (snapshots.length === 0) console.log('No snapshots found.\n');
  for (const snapshot of snapshots) {
    console.log(`### ${snapshot.id} (${snapshot.scope})`);
    console.log(`**Created:** ${snapshot.created_at}`);
    console.log(`**Seen:** ${snapshot.seen_count ?? 1}\n`);
    console.log(`${snapshot.content}\n`);
  }
}

export async function handleMemoryObserve(
  db: Database,
  options: MemoryObserveOptions,
  config: LassoConfig,
) {
  const content = await readMemoryContent(options);
  if (content.trim().length === 0) {
    console.error('memory observe needs --content <text>, --input <path>, or stdin content.');
    process.exit(1);
  }

  const scope = options.scope ?? config.observers.memory.scope;
  const snapshot = createSnapshot(db, { content: content.trim(), scope });

  // Record token count so should-observe can track unobserved tokens
  const observedTokens = options.tokens ? Number(options.tokens) : estimateTokens(content);
  recordObservationTokenCount(db, scope, observedTokens);

  console.log(`Memory snapshot ${snapshot.id} created (${snapshot.scope}).`);
}

export async function handleMemoryReflect(db: Database, options: MemoryReflectOptions) {
  const content = await readMemoryContent(options);
  if (content.trim().length === 0) {
    console.error('memory reflect needs --content <text>, --input <path>, or stdin content.');
    process.exit(1);
  }

  const sourceSnapshotIds = listSnapshots(db, Number(options.limit ?? 20)).map(
    (snapshot) => snapshot.id,
  );
  const reflection = createReflection(db, {
    consolidatedContent: content.trim(),
    sourceSnapshotIds,
  });

  console.log(
    `Memory reflection ${reflection.id} created from ${sourceSnapshotIds.length} snapshots.`,
  );
}

export function handleMemoryShouldObserve(
  db: Database,
  currentTokens: number,
  config: LassoConfig,
) {
  const result = checkShouldObserve(db, currentTokens, config);
  console.log(JSON.stringify(result));
  process.exit(result.needed ? 0 : 1);
}

export function handleMemoryStatus(db: Database) {
  const snapshots = listSnapshots(db, 1);
  const reflections = listReflections(db, 1);

  console.log('Memory Observer Status:');
  console.log(`- Snapshots: ${countSnapshots(db)}`);
  console.log(`- Reflections: ${countReflections(db)}`);
  console.log(`Last snapshot: ${snapshots[0]?.created_at ?? 'never'}`);
  console.log(`Last reflection: ${reflections[0]?.created_at ?? 'never'}`);
}

function distinctSnapshots(snapshots: ReturnType<typeof listSnapshots>) {
  const selected: typeof snapshots = [];

  for (const snapshot of snapshots) {
    if (selected.some((existing) => isNearDuplicate(snapshot.content, existing.content))) continue;
    selected.push(snapshot);
  }

  return selected;
}

function isNearDuplicate(left: string, right: string) {
  return tokenSimilarity(left, right) >= 0.7;
}

async function readMemoryContent(options: MemoryObserveOptions | MemoryReflectOptions) {
  if (options.content) return options.content;
  if (options.input) return Bun.file(options.input).text();
  return Bun.stdin.text();
}
