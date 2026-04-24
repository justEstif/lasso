import type { Database } from 'bun:sqlite';

import { addRecurrence, createEntry, getEntry } from './db.ts';
import { LINT_DETECTOR_VERSION } from './prompt.ts';

export interface DetectorEntry {
  description: string;
  matches_existing_id: null | string;
  proposed_form?: null | string;
  source_excerpt?: null | string;
}

export interface DetectorResult {
  entries: DetectorEntry[];
  found_opportunity: boolean;
  reasoning: string;
}

export interface ScanSummary {
  created: number;
  recurrences: number;
  skipped: number;
}

export function applyDetectorResult(db: Database, result: DetectorResult): ScanSummary {
  const summary = { created: 0, recurrences: 0, skipped: 0 };

  if (!result.found_opportunity) return summary;

  for (const entry of result.entries) {
    if (entry.matches_existing_id) {
      addMatchedRecurrence(db, entry);
      summary.recurrences++;
      continue;
    }

    createEntry(db, {
      description: entry.description,
      detector_version: LINT_DETECTOR_VERSION,
      proposed_form: entry.proposed_form ?? null,
      source_excerpt: entry.source_excerpt ?? null,
      status: 'proposed',
    });
    summary.created++;
  }

  return summary;
}

export function parseDetectorResult(input: string): DetectorResult {
  const parsed = JSON.parse(extractJsonObject(input)) as DetectorResult;
  validateDetectorResult(parsed);
  return parsed;
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

function addMatchedRecurrence(db: Database, entry: DetectorEntry) {
  const existing = getEntry(db, entry.matches_existing_id ?? '');
  if (!existing) {
    throw new Error(`Matched lint entry ${entry.matches_existing_id} not found`);
  }

  addRecurrence(db, existing.id, entry.source_excerpt ?? entry.description);
}

function validateDetectorResult(result: DetectorResult) {
  if (typeof result.found_opportunity !== 'boolean') {
    throw new TypeError('Detector result must include found_opportunity boolean');
  }

  if (typeof result.reasoning !== 'string') {
    throw new TypeError('Detector result must include reasoning string');
  }

  if (!Array.isArray(result.entries)) {
    throw new TypeError('Detector result must include entries array');
  }

  for (const entry of result.entries) {
    validateDetectorEntry(entry);
  }
}

function validateDetectorEntry(entry: DetectorEntry) {
  if (typeof entry.description !== 'string' || entry.description.trim().length === 0) {
    throw new TypeError('Detector entry must include non-empty description');
  }

  const matchId = entry.matches_existing_id;
  if (matchId !== null && typeof matchId !== 'string') {
    throw new TypeError('Detector entry matches_existing_id must be string or null');
  }
}
