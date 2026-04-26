import type { LassoDb } from '../../db/index.ts';
import type { LassoConfig } from '../../config/load.ts';
import type { ObservationEntry, MemoryReflection } from './db.ts';
import type { ObservationPriority } from './parser.ts';

import { checkTokenBudget } from '../service.ts';
import {
  checkShouldReflect,
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
import { buildMemoryStatusModel } from './status.ts';
import { estimateTokens } from './tokens.ts';
import {
  getDefaultTemplate,
  getWorkingMemory,
  listAllWorkingMemory,
  upsertWorkingMemory,
} from './working-db.ts';

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
interface MemoryWorkingOptions {
  edit?: boolean;
  init?: boolean;
  reset?: boolean;
  resource_id?: string;
  stdin?: string;
  thread_id?: string;
}

export async function checkShouldObserve(
  db: LassoDb,
  currentTokens: number,
  config: LassoConfig,
): Promise<ShouldObserveResult> {
  const scope = config.observers.memory.scope;
  return checkTokenBudget({
    currentTokens,
    lastObservedTokens: await getObservationState(db, scope),
    thresholdTokens: config.observers.memory.observationThreshold,
  });
}

export async function handleMemoryContext(db: LassoDb, options: MemoryContextOptions) {
  const filter = buildEntryFilter(options);
  const entries = options.query
    ? await searchEntries(db, options.query, { ...filter, limit: Number(options.limit ?? 10) })
    : await listEntries(db, { ...filter, limit: Number(options.limit ?? 10) });
  console.log('# Lasso Memory Context\n');
  if (entries.length === 0) {
    console.log('No relevant memory found.');
    return;
  }
  for (const entry of entries) {
    const emoji = priorityEmoji(entry.priority as ObservationPriority);
    const category = entry.category ? `[${entry.category}] ` : '';
    console.log(
      `- ${emoji} ${entry.observed_at}: ${category}${formatTemporalAnchor(entry)}${entry.content}`,
    );
  }
}

export async function handleMemoryExport(db: LassoDb, options: MemoryExportOptions = {}) {
  const filter = buildEntryFilter(options);
  const entries = await listEntries(db, { ...filter, limit: 200 });
  const reflections = await listReflections(db, 100);
  console.log('# Memory Observer Export\n');
  renderReflections(reflections);
  renderEntries(entries);
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
  const snapshot = await createSnapshot(db, { content: content.trim(), scope });
  const parsed = parseObservationEntries(content.trim());
  const entries = await createEntries(db, { entries: parsed, snapshotId: snapshot.id });
  const observedTokens = options.tokens ? Number(options.tokens) : estimateTokens(content);
  await recordObservationTokenCount(db, scope, observedTokens);
  console.log(
    `Memory snapshot ${snapshot.id} created with ${entries.length} entries (${snapshot.scope}).`,
  );
}

export async function handleMemoryReflect(db: LassoDb, options: MemoryReflectOptions) {
  const content = await readMemoryContent(options);
  if (content.trim().length === 0) {
    console.error('memory reflect needs --content <text>, --input <path>, or stdin content.');
    process.exit(1);
  }
  const sourceSnapshotIds = (await listSnapshots(db, Number(options.limit ?? 20))).map(
    (snapshot) => snapshot.id,
  );
  const reflection = await createReflection(db, {
    consolidatedContent: content.trim(),
    sourceSnapshotIds,
  });
  console.log(
    `Memory reflection ${reflection.id} created from ${sourceSnapshotIds.length} snapshots.`,
  );
}

export async function handleMemoryShouldObserve(
  db: LassoDb,
  currentTokens: number,
  config: LassoConfig,
) {
  const result = await checkShouldObserve(db, currentTokens, config);
  console.log(JSON.stringify(result));
  process.exit(result.needed ? 0 : 1);
}
export async function handleMemoryShouldReflect(db: LassoDb, config: LassoConfig) {
  const result = await checkShouldReflect(
    db,
    config.observers.memory.scope,
    config.observers.memory.reflectionThreshold,
  );
  console.log(JSON.stringify(result));
  process.exit(result.needed ? 0 : 1);
}
export async function handleMemoryStatus(db: LassoDb) {
  const status = await buildMemoryStatusModel(db);
  console.log('Memory Observer Status:');
  console.log(`- Snapshots: ${status.snapshots}`);
  console.log(`- Entries: ${status.entries}`);
  console.log(`- Reflections: ${status.reflections}`);
  console.log(`Last snapshot: ${status.lastSnapshot}`);
  console.log(`Last reflection: ${status.lastReflection}`);
}
export async function handleMemoryWorking(db: LassoDb, options: MemoryWorkingOptions) {
  if (options.edit) return handleWorkingEdit(db, options);
  if (options.init) return handleWorkingInit(db, options);
  if (options.reset) return handleWorkingReset(db, options);
  return handleWorkingShow(db, options);
}

function buildEntryFilter(options: MemoryContextOptions | MemoryExportOptions) {
  const priority = (options as MemoryContextOptions).priority as ObservationPriority | undefined;
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
function formatTemporalAnchor(entry: {
  referenced_date: null | string;
  relative_offset: null | number;
}): string {
  const parts: string[] = [];
  if (entry.referenced_date) parts.push(`ref:${entry.referenced_date}`);
  if (entry.relative_offset != null) {
    const sign = entry.relative_offset >= 0 ? '+' : '';
    parts.push(`rel:${sign}${entry.relative_offset}d`);
  }
  return parts.length > 0 ? `[${parts.join(', ')}] ` : '';
}
function groupByCategory(entries: ObservationEntry[]) {
  const groups = new Map<string, ObservationEntry[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.category) ?? [];
    existing.push(entry);
    groups.set(entry.category, existing);
  }
  return groups;
}

async function handleWorkingEdit(db: LassoDb, options: MemoryWorkingOptions) {
  const content = options.stdin?.trim();
  if (!content) {
    console.error('memory working --edit needs content via stdin.');
    process.exit(1);
  }
  const record = await upsertWorkingMemory(db, {
    content,
    resourceId: options.resource_id,
    threadId: options.thread_id,
  });
  console.log(`Working memory ${record.id} updated.`);
}
async function handleWorkingInit(db: LassoDb, options: MemoryWorkingOptions) {
  const existing = await getWorkingMemory(db, {
    resourceId: options.resource_id,
    threadId: options.thread_id,
  });
  if (existing) {
    console.log(`Working memory already exists (${existing.id}). Use --edit to update.`);
    return;
  }
  const record = await upsertWorkingMemory(db, {
    content: getDefaultTemplate(),
    resourceId: options.resource_id,
    threadId: options.thread_id,
  });
  console.log(`Working memory ${record.id} initialized with default template.`);
}
async function handleWorkingReset(db: LassoDb, options: MemoryWorkingOptions) {
  const record = await upsertWorkingMemory(db, {
    content: getDefaultTemplate(),
    resourceId: options.resource_id,
    threadId: options.thread_id,
  });
  console.log(`Working memory ${record.id} reset to default template.`);
}
async function handleWorkingShow(db: LassoDb, options: MemoryWorkingOptions) {
  const record = await getWorkingMemory(db, {
    resourceId: options.resource_id,
    threadId: options.thread_id,
  });
  if (!record) {
    const all = await listAllWorkingMemory(db);
    if (all.length === 0) {
      console.log('No working memory found. Use --init to create one.');
      return;
    }
    for (const entry of all) printWorkingMemoryEntry(entry);
    return;
  }
  printWorkingMemoryEntry(record);
}
function printWorkingMemoryEntry(entry: { content: string; id: string; updated_at: string }) {
  console.log(`# Working Memory (${entry.id})`);
  console.log(`Updated: ${entry.updated_at}\n`);
  console.log(entry.content);
}
async function readMemoryContent(options: MemoryObserveOptions | MemoryReflectOptions) {
  if (options.content) return options.content;
  if (options.input) return Bun.file(options.input).text();
  return Bun.stdin.text();
}
function renderEntries(entries: ObservationEntry[]) {
  console.log('## Observation Entries\n');
  if (entries.length === 0) {
    console.log('No observation entries found.\n');
    return;
  }
  for (const [category, categoryEntries] of groupByCategory(entries)) {
    if (category) console.log(`### ${category}\n`);
    for (const entry of categoryEntries) {
      const emoji = priorityEmoji(entry.priority as ObservationPriority);
      console.log(
        `- ${emoji} ${entry.observed_at}: ${formatTemporalAnchor(entry)}${entry.content}`,
      );
    }
    console.log();
  }
}
function renderReflections(reflections: MemoryReflection[]) {
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
