import type { LassoDb } from '../../db/index.ts';

import * as v from 'valibot';

import { addRecurrence, createEntry, getEntry } from './db.ts';
import { LINT_DETECTOR_VERSION } from './prompt.ts';

const DetectorEntrySchema = v.object({
  affected_paths: v.optional(v.array(v.pipe(v.string(), v.trim(), v.nonEmpty()))),
  category: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.nonEmpty()))),
  description: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  matches_existing_id: v.nullable(v.pipe(v.string(), v.trim())),
  proposed_form: v.optional(v.nullable(v.string())),
  referenced_date: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.nonEmpty()))),
  relative_offset: v.optional(v.nullable(v.number())),
  severity: v.optional(v.nullable(v.picklist(['high', 'low', 'medium']))),
  source_excerpt: v.optional(v.nullable(v.string())),
});

const DetectorResultSchema = v.object({
  entries: v.array(DetectorEntrySchema),
  found_opportunity: v.boolean(),
  reasoning: v.pipe(v.string(), v.trim(), v.nonEmpty()),
});

export type DetectorEntry = v.InferOutput<typeof DetectorEntrySchema>;
export type DetectorResult = v.InferOutput<typeof DetectorResultSchema>;

export interface ScanSummary {
  created: number;
  recurrences: number;
  skipped: number;
}

export async function applyDetectorResult(
  db: LassoDb,
  result: DetectorResult,
): Promise<ScanSummary> {
  const summary = { created: 0, recurrences: 0, skipped: 0 };

  if (!result.found_opportunity) return summary;

  for (const entry of result.entries) {
    if (entry.matches_existing_id) {
      await addMatchedRecurrence(db, entry);
      summary.recurrences++;
      continue;
    }

    await createEntry(db, {
      affected_paths: entry.affected_paths ?? [],
      category: entry.category ?? null,
      description: entry.description,
      detector_version: LINT_DETECTOR_VERSION,
      proposed_form: entry.proposed_form ?? null,
      referenced_date: entry.referenced_date ?? null,
      relative_offset: entry.relative_offset ?? null,
      severity: entry.severity ?? 'medium',
      source_excerpt: entry.source_excerpt ?? null,
      status: 'proposed',
    });
    summary.created++;
  }

  return summary;
}

export function parseDetectorResult(input: string): DetectorResult {
  const parsed = JSON.parse(extractJsonObject(input)) as unknown;
  return v.parse(DetectorResultSchema, parsed);
}

export function extractJsonObject(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  throw new SyntaxError('Detector output did not contain a JSON object');
}

async function addMatchedRecurrence(db: LassoDb, entry: DetectorEntry) {
  const existing = await getEntry(db, entry.matches_existing_id ?? '');
  if (!existing) {
    throw new Error(`Matched lint entry ${entry.matches_existing_id} not found`);
  }

  await addRecurrence(db, existing.id, {
    note: entry.source_excerpt ?? entry.description,
    referencedDate: entry.referenced_date ?? null,
    relativeOffset: entry.relative_offset ?? null,
  });
}
