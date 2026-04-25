import { Database } from 'bun:sqlite';

import type { LassoConfig } from '../../config/load.ts';
import type { ObservationPriority } from './parser.ts';

import {
  countEntries,
  countReflections,
  countSnapshots,
  createEntries,
  createReflection,
  createSnapshot,
  getObservationState,
  listEntries,
  listReflections,
  listSnapshots,
  parseSourceSnapshotIds,
  recordObservationTokenCount,
  searchEntries,
} from './db.ts';
import { parseObservationEntries, priorityEmoji } from './parser.ts';
import { estimateTokens } from './tokens.ts';

export interface ShouldObserveResult {
  currentTokens: number;
  lastObserved: number;
  needed: boolean;
  threshold: number;
  unobserved: number;
}

interface MemoryContextOptions {
  after?: string;
  before?: string;
  limit?: string;
  priority?: string;
  query?: string;
  sort?: string;
}

interface MemoryExportOptions {
  after?: string;
  before?: string;
  priority?: string;
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
  const filter = buildEntryFilter(options);
  const entries = options.query
    ? searchEntries(db, options.query, { ...filter, limit: Number(options.limit ?? 10) })
    : listEntries(db, { ...filter, limit: Number(options.limit ?? 10) });

  console.log('# Lasso Memory Context\n');
  if (entries.length === 0) {
    console.log('No relevant memory found.');
    return;
  }

  for (const entry of entries) {
    const emoji = priorityEmoji(entry.priority as ObservationPriority);
    const category = entry.category ? `[${entry.category}] ` : '';
    const temporal = formatTemporalAnchor(entry);
    console.log(`- ${emoji} ${entry.observed_at}: ${category}${temporal}${entry.content}`);
  }
}

export function handleMemoryExport(db: Database, options: MemoryExportOptions = {}) {
  const filter = buildEntryFilter(options);
  const entries = listEntries(db, { ...filter, limit: 200 });
  const reflections = listReflections(db, 100);

  console.log('# Memory Observer Export\n');
  renderReflections(reflections);
  renderEntries(entries);
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

  const parsed = parseObservationEntries(content.trim());
  const entries = createEntries(db, { entries: parsed, snapshotId: snapshot.id });

  const observedTokens = options.tokens ? Number(options.tokens) : estimateTokens(content);
  recordObservationTokenCount(db, scope, observedTokens);

  console.log(
    `Memory snapshot ${snapshot.id} created with ${entries.length} entries (${snapshot.scope}).`,
  );
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
  console.log(`- Entries: ${countEntries(db)}`);
  console.log(`- Reflections: ${countReflections(db)}`);
  console.log(`Last snapshot: ${snapshots[0]?.created_at ?? 'never'}`);
  console.log(`Last reflection: ${reflections[0]?.created_at ?? 'never'}`);
}

function buildEntryFilter(options: MemoryContextOptions | MemoryExportOptions) {
  const priority = (options as MemoryContextOptions).priority as
    | ObservationPriority
    | undefined;
  const sort = (options as MemoryContextOptions).sort?.split(':') as
    | ['created_at' | 'observed_at' | 'referenced_date', 'asc' | 'desc']
    | undefined;

  return {
    after: options.after,
    before: options.before,
    priority,
    sortField: sort?.[0],
    sortOrder: sort?.[1],
  };
}

function formatTemporalAnchor(entry: { referenced_date: null | string; relative_offset: null | number }): string {
  const parts: string[] = [];
  if (entry.referenced_date) parts.push(`ref:${entry.referenced_date}`);
  if (entry.relative_offset != null) {
    const sign = entry.relative_offset >= 0 ? '+' : '';
    parts.push(`rel:${sign}${entry.relative_offset}d`);
  }
  return parts.length > 0 ? `[${parts.join(', ')}] ` : '';
}

function groupByCategory(entries: ReturnType<typeof listEntries>) {
  const groups = new Map<string, typeof entries>();

  for (const entry of entries) {
    const existing = groups.get(entry.category) ?? [];
    existing.push(entry);
    groups.set(entry.category, existing);
  }

  return groups;
}

async function readMemoryContent(options: MemoryObserveOptions | MemoryReflectOptions) {
  if (options.content) return options.content;
  if (options.input) return Bun.file(options.input).text();
  return Bun.stdin.text();
}

function renderEntries(entries: ReturnType<typeof listEntries>) {
  console.log('## Observation Entries\n');
  if (entries.length === 0) {
    console.log('No observation entries found.\n');
    return;
  }

  const grouped = groupByCategory(entries);
  for (const [category, categoryEntries] of grouped) {
    if (category) console.log(`### ${category}\n`);
    for (const entry of categoryEntries) {
      const emoji = priorityEmoji(entry.priority as ObservationPriority);
      const temporal = formatTemporalAnchor(entry);
      console.log(`- ${emoji} ${entry.observed_at}: ${temporal}${entry.content}`);
    }
    console.log();
  }
}

function renderReflections(reflections: ReturnType<typeof listReflections>) {
  console.log('## Reflections\n');
  if (reflections.length === 0) {
    console.log('No reflections found.\n');
    return;
  }

  for (const reflection of reflections) {
    console.log(`### ${reflection.id}`);
    console.log(`**Created:** ${reflection.created_at}`);
    console.log(`**Sources:** ${parseSourceSnapshotIds(reflection).join(', ') || 'none'}\n`);
    console.log(`${reflection.consolidated_content}\n`);
  }
}
