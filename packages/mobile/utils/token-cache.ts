import { Platform } from "react-native";

type TokenCache = {
  getToken: (key: string) => Promise<string | null | undefined>;
  saveToken: (key: string, value: string) => Promise<void>;
  clearToken?: (key: string) => Promise<void>;
};

/** If the keychain does not answer in time we fall back to memory so the UI still renders. */
const SECURE_STORE_TIMEOUT_MS = 3000;

const TIMED_OUT = Symbol("timed-out");

async function withTimeout<T>(promise: Promise<T>): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), SECURE_STORE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let secureStoreCache: TokenCache | null = null;

async function getSecureStoreCache(): Promise<TokenCache> {
  if (!secureStoreCache) {
    // Lazy import: the native module is not touched until Clerk first asks for a token.
    const { createSecureStoreTokenCache } = await import(
      "./secure-store-token-cache"
    );
    secureStoreCache = createSecureStoreTokenCache();
  }
  return secureStoreCache;
}

/**
 * Keychain-backed cache with an in-memory mirror. Once the keychain times out or fails
 * to load, it is skipped for the rest of the session and memory is used alone.
 */
function createResilientTokenCache(): TokenCache {
  const memory = new Map<string, string>();
  let storeDisabled = false;

  const useStore = async <T>(run: (cache: TokenCache) => Promise<T>): Promise<T | typeof TIMED_OUT> => {
    if (storeDisabled) return TIMED_OUT;
    try {
      const result = await withTimeout(getSecureStoreCache().then(run));
      if (result === TIMED_OUT) {
        storeDisabled = true;
        console.warn("[TokenCache] secure store timed out; using memory only");
      }
      return result;
    } catch (err) {
      storeDisabled = true;
      console.warn("[TokenCache] secure store unavailable; using memory only", err);
      return TIMED_OUT;
    }
  };

  return {
    async getToken(key) {
      if (memory.has(key)) return memory.get(key) ?? null;
      const stored = await useStore((cache) => cache.getToken(key));
      // On timeout we report no token, so a slow keychain looks signed out for this launch only.
      if (stored === TIMED_OUT) return null;
      if (stored) memory.set(key, stored);
      return stored ?? null;
    },
    async saveToken(key, value) {
      memory.set(key, value);
      await useStore((cache) => cache.saveToken(key, value));
    },
    async clearToken(key) {
      memory.delete(key);
      // Always attempt the keychain delete (even if the store was disabled or is slow) so a
      // sign-out cannot resurface the session on the next launch. Not awaited: never blocks UI.
      void getSecureStoreCache()
        .then((cache) => cache.clearToken?.(key))
        .catch((err) => console.warn("[TokenCache] keychain clear failed", err));
    },
  };
}

/** Native: SecureStore (keychain) with memory fallback. Web: undefined (Clerk uses its own storage). */
export function getClerkTokenCache(): TokenCache | undefined {
  if (Platform.OS === "web") {
    return undefined;
  }
  return createResilientTokenCache();
}
