/**
 * Approximate token count without bundling tiktoken WASM.
 * ASCII text is ~4 chars/token; this is used for UI budgets, not billing.
 */
const CHARS_PER_TOKEN = 4;

let initialized = false;

export function initializeTokenCounter(): Promise<void> {
  initialized = true;
  return Promise.resolve();
}

export function getTokenCount(text: string): number {
  if (!initialized) {
    throw new Error(
      "Token counter not initialized. Call initializeTokenCounter() first."
    );
  }
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function cleanup(): void {
  initialized = false;
}
