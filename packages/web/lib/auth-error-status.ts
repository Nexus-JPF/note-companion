/**
 * The HTTP status carried by an authorization error (for example the 401, 403
 * or 429 that handleAuthorizationV2 throws), when it is a client error. Lets
 * routes pass those through instead of turning them into a generic 500.
 */
export function clientErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && status >= 400 && status < 500
    ? status
    : null;
}
