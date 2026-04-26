import type { LassoDb } from '../../db/index.ts';

import type { MemoryReflection, MemorySnapshot } from './db.ts';

import {
  countEntries,
  countReflections,
  countSnapshots,
  listReflections,
  listSnapshots,
} from './db.ts';

export interface MemoryStatusModel {
  entries: number;
  lastReflection: string;
  lastSnapshot: string;
  recentReflections: MemoryReflection[];
  recentSnapshots: MemorySnapshot[];
  reflections: number;
  snapshots: number;
}

/**
 * Builds the memory observer status snapshot used by CLI and TUI renderers.
 *
 * The model hides which repository calls are needed for counts vs. recency so
 * display surfaces can stay focused on presentation.
 */
export async function buildMemoryStatusModel(db: LassoDb): Promise<MemoryStatusModel> {
  const recentSnapshots = await listSnapshots(db, 5);
  const recentReflections = await listReflections(db, 3);

  return {
    entries: await countEntries(db),
    lastReflection: recentReflections[0]?.created_at ?? 'never',
    lastSnapshot: recentSnapshots[0]?.created_at ?? 'never',
    recentReflections,
    recentSnapshots,
    reflections: await countReflections(db),
    snapshots: await countSnapshots(db),
  };
}
