export type ObservationPriority = 'high' | 'low' | 'medium';

export interface ParsedEntry {
  category: string;
  content: string;
  observedAt: string;
  priority: ObservationPriority;
}

const PRIORITY_MAP: Record<string, ObservationPriority> = {
  '\u{1F534}': 'high',
  '\u{1F7E1}': 'medium',
  '\u{1F7E2}': 'low',
  high: 'high',
  low: 'low',
  medium: 'medium',
};

const ENTRY_LINE_PATTERN =
  /^[-*]\s+(?<priority>\p{Emoji_Presentation}|\[high\]|\[medium\]|\[low\])\s+(?<date>\d{4}-\d{2}-\d{2}):\s+(?<text>.{1,500})$/u;

const HEADER_PATTERN = /^##\s+(.+)/;

export function parseObservationEntries(content: string): ParsedEntry[] {
  const lines = content.split('\n');
  const entries: ParsedEntry[] = [];
  let category = '';

  for (const line of lines) {
    const trimmed = line.trim();
    const header = HEADER_PATTERN.exec(trimmed);
    if (header?.[1]) {
      category = header[1].trim();
      continue;
    }

    const entry = parseEntryLine(trimmed, category);
    if (entry) entries.push(entry);
  }

  return entries.length > 0 ? entries : [fallbackEntry(content)];
}

export function priorityEmoji(priority: ObservationPriority): string {
  const emojis: Record<ObservationPriority, string> = {
    high: '\u{1F534}',
    low: '\u{1F7E2}',
    medium: '\u{1F7E1}',
  };

  return emojis[priority];
}

function fallbackEntry(content: string): ParsedEntry {
  return {
    category: '',
    content: content.trim(),
    observedAt: today(),
    priority: 'medium',
  };
}

function normalizePriority(raw: string): null | ObservationPriority {
  const bracketMatch = raw.match(/^\[(.+)\]$/);
  if (bracketMatch?.[1]) return PRIORITY_MAP[bracketMatch[1]] ?? null;
  return PRIORITY_MAP[raw] ?? null;
}

function parseEntryLine(line: string, category: string): null | ParsedEntry {
  const match = ENTRY_LINE_PATTERN.exec(line);
  if (!match?.groups) return null;

  const priority = normalizePriority(match.groups.priority ?? '');
  if (!priority) return null;

  const text = (match.groups.text ?? '').trim();
  if (text.length === 0) return null;

  return {
    category,
    content: text,
    observedAt: match.groups.date ?? today(),
    priority,
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
