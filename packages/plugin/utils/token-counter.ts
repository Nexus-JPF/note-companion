/**
 * Approximate token count without bundling tiktoken WASM.
 * ASCII text is ~4 chars/token; this is used for UI budgets, not billing.
 */
const CHARS_PER_TOKEN = 4;

export function initializeTokenCounter(): Promise<void> {
  return Promise.resolve();
}

export function getTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** No-op: counting is a pure heuristic (no WASM to unload). Kept for callers. */
export function cleanup(): void {}
