// Best-effort in-memory sliding-window limiter for credential endpoints.
// State is per serverless instance, so this only slows down naive brute force;
// Clerk enforces its own password-attempt limits on top of this.
const attempts = new Map<string, number[]>();
const MAX_KEYS = 5000;

export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): boolean {
  const recent = (attempts.get(key) ?? []).filter(t => now - t < windowMs);
  if (recent.length >= limit) {
    attempts.set(key, recent);
    return true;
  }
  recent.push(now);
  attempts.set(key, recent);

  if (attempts.size > MAX_KEYS) {
    for (const [k, times] of attempts) {
      if (times.every(t => now - t >= windowMs)) attempts.delete(k);
    }
  }
  return false;
}

export function resetRateLimitsForTests() {
  attempts.clear();
}
