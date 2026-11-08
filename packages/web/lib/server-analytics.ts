import { randomUUID } from 'crypto';
import PostHogClient from '@/lib/posthog';

type EventProperties = Record<string, string | number | boolean | null>;

/**
 * Capture a server-side product event. Never throws and never blocks the
 * caller's response on analytics failures. Do not put emails, vault content
 * or other personal data in `properties`: use ids, counts and categories only.
 *
 * Pass `userId` for a known user. Without one the event is recorded as an
 * anonymous count (no person profile), e.g. for failed sign-ins.
 */
export async function captureServerEvent(
  event: string,
  properties: EventProperties = {},
  userId?: string
): Promise<void> {
  try {
    const client = PostHogClient();
    if (!client) return;

    client.capture({
      distinctId: userId ?? `anon-${randomUUID()}`,
      event,
      properties: userId
        ? properties
        : { ...properties, $process_person_profile: false },
    });
    // Serverless functions can freeze right after responding, so flush now
    await client.shutdown();
  } catch (error) {
    console.error('Failed to capture server event', event, error);
  }
}
