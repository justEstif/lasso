export interface SaturationGateInput {
  activeCount: number;
  limit: number;
}

export interface SaturationGateResult {
  activeCount: number;
  limit: number;
  saturated: boolean;
}

export interface TokenBudgetGateInput {
  currentTokens: number;
  lastObservedTokens: number;
  thresholdTokens: number;
}

export interface TokenBudgetGateResult {
  currentTokens: number;
  lastObserved: number;
  needed: boolean;
  threshold: number;
  unobserved: number;
}

/**
 * Computes whether an observer should pause because pending work is already saturated.
 *
 * This keeps caller-facing policy simple: reaching the limit means no more proposals
 * should be created until the user resolves existing work.
 */
export function checkSaturation(input: SaturationGateInput): SaturationGateResult {
  const activeCount = Math.max(0, input.activeCount);
  const limit = Math.max(0, input.limit);

  return {
    activeCount,
    limit,
    saturated: activeCount >= limit,
  };
}

/**
 * Computes whether an observer has enough new conversation to justify an LLM call.
 *
 * Observers own how they persist the last observed token count; this helper owns the
 * shared threshold semantics so every observer treats token budgets consistently.
 */
export function checkTokenBudget(input: TokenBudgetGateInput): TokenBudgetGateResult {
  const currentTokens = Math.max(0, input.currentTokens);
  const lastObserved = Math.max(0, input.lastObservedTokens);
  const threshold = Math.max(0, input.thresholdTokens);
  const unobserved = Math.max(0, currentTokens - lastObserved);

  return {
    currentTokens,
    lastObserved,
    needed: unobserved >= threshold,
    threshold,
    unobserved,
  };
}
