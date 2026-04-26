import type { LassoDb } from '../../db/index.ts';

import type { LassoConfig } from '../../config/load.ts';
import type { LintEntry, LintScanRun, LintStatus } from './db.ts';

import { checkSaturation } from '../service.ts';
import { getLastScanRun, listEntries } from './db.ts';

export interface LintStatusModel {
  counts: Record<LintStatus, number>;
  entries: LintEntry[];
  lastScan: LintScanRun | null;
  saturation: ReturnType<typeof checkSaturation>;
  staleProposed: number;
  total: number;
}

/**
 * Builds the lint observer status snapshot used by CLI and TUI renderers.
 *
 * Keeping status semantics here prevents every surface from re-learning which
 * states count as stale, throttled, or active.
 */
export async function buildLintStatusModel(
  db: LassoDb,
  config: LassoConfig,
): Promise<LintStatusModel> {
  const entries = await listEntries(db);
  const counts = countLintStatuses(entries);
  const lintConfig = config.observers.lint;

  return {
    counts,
    entries,
    lastScan: await getLastScanRun(db),
    saturation: checkSaturation({ activeCount: counts.proposed, limit: lintConfig.throttleLimit }),
    staleProposed: countStaleProposed(entries, lintConfig.staleAfterDays),
    total: entries.length,
  };
}

export function countLintStatuses(entries: LintEntry[]): Record<LintStatus, number> {
  const counts = { accepted: 0, deferred: 0, implemented: 0, proposed: 0, rejected: 0 };

  for (const entry of entries) {
    counts[entry.status]++;
  }

  return counts;
}

function countStaleProposed(entries: LintEntry[], staleAfterDays: number) {
  const staleBefore = Date.now() - staleAfterDays * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => {
    return entry.status === 'proposed' && new Date(entry.created_at).getTime() < staleBefore;
  }).length;
}
