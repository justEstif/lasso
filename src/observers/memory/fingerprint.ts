import { createHash } from 'node:crypto';

export function hammingDistance(left: string, right: string): number {
  const leftValue = BigInt(`0x${left}`);
  const rightValue = BigInt(`0x${right}`);
  let diff = leftValue ^ rightValue;
  let distance = 0;

  while (diff > 0n) {
    distance += Number(diff & 1n);
    diff >>= 1n;
  }

  return distance;
}

export function memoryFingerprint(content: string): string {
  const weights = Array.from({ length: 64 }, () => 0);
  for (const token of significantTokens(content)) {
    const hash = createHash('sha256').update(token).digest();
    for (let bit = 0; bit < 64; bit += 1) {
      const byte = hash[Math.floor(bit / 8)] ?? 0;
      const mask = 1 << (bit % 8);
      weights[bit] = (weights[bit] ?? 0) + (byte & mask ? 1 : -1);
    }
  }

  let value = 0n;
  for (let bit = 0; bit < 64; bit += 1) {
    if ((weights[bit] ?? 0) > 0) value |= 1n << BigInt(bit);
  }

  return value.toString(16).padStart(16, '0');
}

export function normalizedMemoryHash(content: string): string {
  return createHash('sha256').update(normalizeMemory(content)).digest('hex');
}

export function significantTokens(content: string): string[] {
  return (
    content
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9_.:/-]{2,}/g)
      ?.filter((token) => !memoryStopWords.has(token)) ?? []
  );
}

export function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(significantTokens(left));
  const rightTokens = new Set(significantTokens(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / Math.min(leftTokens.size, rightTokens.size);
}

function normalizeMemory(content: string): string {
  return content
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const memoryStopWords = new Set([
  'and',
  'are',
  'but',
  'for',
  'from',
  'has',
  'the',
  'this',
  'user',
  'with',
]);
