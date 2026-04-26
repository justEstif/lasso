import type { LassoConfig } from '../../config/load.ts';
import type { LassoDb } from '../../db/index.ts';
import type { LintEntry, LintScanRun, LintStatus } from './db.ts';

import { checkSaturation } from '../service.ts';
import { countByStatus, countStaleProposed, getLastScanRun, listEntries } from './db.ts';

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
export function buildLintStatusModel(db: LassoDb, config: LassoConfig): LintStatusModel {
  const entries = listEntries(db);
  const counts = countByStatus(db);
  const lintConfig = config.observers.lint;

  return {
    counts,
    entries,
    lastScan: getLastScanRun(db),
    saturation: checkSaturation({ activeCount: counts.proposed, limit: lintConfig.throttleLimit }),
    staleProposed: countStaleProposed(db, lintConfig.staleAfterDays),
    total: entries.length,
  };
}

// countLintStatuses kept for backward compat with any callers doing JS-side counting
export function countLintStatuses(entries: LintEntry[]): Record<LintStatus, number> {
  const counts: Record<LintStatus, number> = {
    accepted: 0,
    deferred: 0,
    implemented: 0,
    proposed: 0,
    rejected: 0,
  };
  for (const entry of entries) counts[entry.status]++;
  return counts;
}
