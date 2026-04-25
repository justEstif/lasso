import { Database } from 'bun:sqlite';

import type { LassoConfig } from '../../config/load.ts';

import {
  countReflections,
  countSnapshots,
  createReflection,
  createSnapshot,
  listReflections,
  listSnapshots,
  parseSourceSnapshotIds,
} from './db.ts';

interface MemoryObserveOptions {
  content?: string;
  input?: string;
  scope?: 'resource' | 'thread';
}

interface MemoryReflectOptions {
  content?: string;
  emitContent?: boolean;
  input?: string;
  limit?: string;
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

  const snapshot = createSnapshot(db, {
    content: content.trim(),
    scope: options.scope ?? config.observers.memory.scope,
  });

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
  const reflectionContent = content.trim();
  const reflection = createReflection(db, {
    consolidatedContent: reflectionContent,
    sourceSnapshotIds,
  });

  if (options.emitContent) {
    console.log(reflectionContent);
    return;
  }

  console.log(
    `Memory reflection ${reflection.id} created from ${sourceSnapshotIds.length} snapshots.`,
  );
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

export function handleMemoryExport(db: Database) {
  const snapshots = listSnapshots(db, 100);
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
    console.log(`**Created:** ${snapshot.created_at}\n`);
    console.log(`${snapshot.content}\n`);
  }
}

async function readMemoryContent(options: MemoryObserveOptions | MemoryReflectOptions) {
  if (options.content) return options.content;
  if (options.input) return Bun.file(options.input).text();
  return Bun.stdin.text();
}
