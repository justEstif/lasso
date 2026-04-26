import type { LassoConfig } from '../../config/load.ts';
import type { LassoDb } from '../../db/index.ts';
import type { ObservationPriority } from './parser.ts';

import { checkTokenBudget, runObserverLifecycle } from '../service.ts';
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
  force?: boolean;
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

// ---------------------------------------------------------------------------
// Pure orchestration functions (no console.log / process.exit)
// ---------------------------------------------------------------------------

export function checkShouldObserve(
  db: LassoDb,
  currentTokens: number,
  config: LassoConfig,
): ShouldObserveResult {
  const scope = config.observers.memory.scope;
  const threshold = config.observers.memory.observationThreshold;
  return checkTokenBudget({
    currentTokens,
    lastObservedTokens: getObservationState(db, scope),
    thresholdTokens: threshold,
  });
}

export function executeMemoryObserve(
  db: LassoDb,
  options: { content: string; force?: boolean; observedTokens: number; scope: 'resource' | 'thread' },
  config: LassoConfig,
) {
  const tokenBudget = checkTokenBudget({
    currentTokens: options.observedTokens,
    lastObservedTokens: getObservationState(db, options.scope),
    thresholdTokens: config.observers.memory.observationThreshold,
  });

  return runObserverLifecycle({
    force: options.force,
    gates: { tokenBudget },
    observe: () => persistMemoryObservation(db, options.content, options.scope),
    persistProgress: (progress) => {
      recordObservationTokenCount(db, options.scope, progress.observedTokens);
    },
  });
}

export function executeMemoryReflect(
  db: LassoDb,
  content: string,
  limit = 20,
) {
  const sourceSnapshotIds = listSnapshots(db, limit).map((s) => s.id);
  const reflection = createReflection(db, {
    consolidatedContent: content.trim(),
    sourceSnapshotIds,
  });
  return { reflection, sourceSnapshotCount: sourceSnapshotIds.length };
}

export function executeWorkingMemoryAction(db: LassoDb, options: MemoryWorkingOptions) {
  if (options.edit) return doWorkingEdit(db, options);
  if (options.init) return doWorkingInit(db, options);
  if (options.reset) return doWorkingReset(db, options);
  return doWorkingShow(db, options);
}

export function getMemoryContextText(db: LassoDb, options: MemoryContextOptions): string {
  const filter = buildEntryFilter(options);
  const entries = options.query
    ? searchEntries(db, options.query, { ...filter, limit: Number(options.limit ?? 10) })
    : listEntries(db, { ...filter, limit: Number(options.limit ?? 10) });

  if (entries.length === 0) return '# Lasso Memory Context\n\nNo relevant memory found.';

  const lines = ['# Lasso Memory Context', ''];
  for (const entry of entries) {
    const emoji = priorityEmoji(entry.priority as ObservationPriority);
    const category = entry.category ? `[${entry.category}] ` : '';
    const temporal = formatTemporalAnchor(entry);
    lines.push(`- ${emoji} ${entry.observed_at}: ${category}${temporal}${entry.content}`);
  }
  return lines.join('\n');
}

export function getMemoryExportText(db: LassoDb, options: MemoryExportOptions = {}): string {
  const filter = buildEntryFilter(options);
  const entries = listEntries(db, { ...filter, limit: 200 });
  const reflections = listReflections(db, 100);

  return ['# Memory Observer Export', '', ...renderReflectionsText(reflections), ...renderEntriesText(entries)].join('\n');
}

export function getMemoryStatusText(db: LassoDb): string {
  const status = buildMemoryStatusModel(db);
  return [
    'Memory Observer Status:',
    `- Snapshots: ${status.snapshots}`,
    `- Entries: ${status.entries}`,
    `- Reflections: ${status.reflections}`,
    `Last snapshot: ${status.lastSnapshot}`,
    `Last reflection: ${status.lastReflection}`,
  ].join('\n');
}

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

function doWorkingEdit(db: LassoDb, options: MemoryWorkingOptions) {
  const content = options.stdin?.trim();
  if (!content) {
    return { text: 'memory working --edit needs content via stdin.', wasError: true as const };
  }
  const record = upsertWorkingMemory(db, {
    content,
    resourceId: options.resource_id,
    threadId: options.thread_id,
  });
  return { text: `Working memory ${record.id} updated.` };
}

function doWorkingInit(db: LassoDb, options: MemoryWorkingOptions) {
  const existing = getWorkingMemory(db, {
    resourceId: options.resource_id,
    threadId: options.thread_id,
  });
  if (existing) {
    return { text: `Working memory already exists (${existing.id}). Use --edit to update.` };
  }
  const record = upsertWorkingMemory(db, {
    content: getDefaultTemplate(),
    resourceId: options.resource_id,
    threadId: options.thread_id,
  });
  return { text: `Working memory ${record.id} initialized with default template.` };
}

function doWorkingReset(db: LassoDb, options: MemoryWorkingOptions) {
  const record = upsertWorkingMemory(db, {
    content: getDefaultTemplate(),
    resourceId: options.resource_id,
    threadId: options.thread_id,
  });
  return { text: `Working memory ${record.id} reset to default template.` };
}

function doWorkingShow(db: LassoDb, options: MemoryWorkingOptions) {
  const record = getWorkingMemory(db, {
    resourceId: options.resource_id,
    threadId: options.thread_id,
  });
  if (!record) {
    const all = listAllWorkingMemory(db);
    if (all.length === 0) return { text: 'No working memory found. Use --init to create one.' };
    return { text: all.map((e) => formatWorkingMemoryEntry(e)).join('\n') };
  }
  return { text: formatWorkingMemoryEntry(record) };
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

function formatWorkingMemoryEntry(entry: { content: string; id: string; updated_at: string }) {
  return `# Working Memory (${entry.id})\nUpdated: ${entry.updated_at}\n\n${entry.content}`;
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

function persistMemoryObservation(db: LassoDb, content: string, scope: 'resource' | 'thread') {
  const snapshot = createSnapshot(db, { content: content.trim(), scope });
  const parsed = parseObservationEntries(content.trim());
  const entries = createEntries(db, { entries: parsed, snapshotId: snapshot.id });
  return { entries, scope, snapshotId: snapshot.id };
}

async function readMemoryContent(options: MemoryObserveOptions | MemoryReflectOptions) {
  if (options.content) return options.content;
  if (options.input) return Bun.file(options.input).text();
  return Bun.stdin.text();
}

function renderEntriesText(entries: ReturnType<typeof listEntries>): string[] {
  const parts: string[] = ['## Observation Entries', ''];
  if (entries.length === 0) {
    parts.push('No observation entries found.', '');
    return parts;
  }

  const grouped = groupByCategory(entries);
  for (const [category, categoryEntries] of grouped) {
    if (category) parts.push(`### ${category}`, '');
    for (const entry of categoryEntries) {
      const emoji = priorityEmoji(entry.priority as ObservationPriority);
      const temporal = formatTemporalAnchor(entry);
      parts.push(`- ${emoji} ${entry.observed_at}: ${temporal}${entry.content}`);
    }
    parts.push('');
  }
  return parts;
}

function renderReflectionsText(reflections: ReturnType<typeof listReflections>): string[] {
  const parts: string[] = ['## Reflections', ''];
  if (reflections.length === 0) {
    parts.push('No reflections found.', '');
    return parts;
  }

  for (const reflection of reflections) {
    parts.push(
      `### ${reflection.id}`,
      `**Created:** ${reflection.created_at}`,
      `**Sources:** ${parseSourceSnapshotIds(reflection).join(', ') || 'none'}`,
      '',
      `${reflection.consolidated_content}`,
      '',
    );
  }
  return parts;
}
