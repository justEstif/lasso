/**
 * Fast local token estimation for observation thresholding.
 *
 * Uses the standard heuristic: ~4 characters per token for English text.
 * This is intentionally approximate — we just need to know "roughly how big
 * is the conversation" to decide whether observation is warranted.
 *
 * Mastra uses a similar approach (tokenx for text, provider heuristics for
 * images). We don't need that precision since we're thresholding, not billing.
 */

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}
