import { auth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { extractUserId, verifyUnkeyApiKey } from '@/lib/unkey-client';

/**
 * Identify the caller: a valid API key (plugin, mobile) or the Clerk session
 * (web). Unlike handleAuthorizationV2 this does NOT also require an active
 * plan and remaining tokens, so use it for things people must always be able
 * to do with their own data, such as deleting a file.
 *
 * A request that sends an Authorization header is judged by that key alone:
 * an invalid key never falls back to the session.
 */
export async function authenticateUser(req: NextRequest): Promise<string | null> {
  // Same behavior as handleAuthorizationV2 when user management is off (self-hosting)
  if (process.env.ENABLE_USER_MANAGEMENT !== 'true') return 'user';

  const token = req.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();

  if (token) {
    const { result, error } = await verifyUnkeyApiKey(token);
    if (error || !result?.valid) return null;
    return extractUserId(result) ?? null;
  }

  const { userId } = await auth();
  return userId ?? null;
}
