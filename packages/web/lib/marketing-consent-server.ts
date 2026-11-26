import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import {
  getLoopsMarketingConsent,
  setLoopsMarketingConsent,
  type MarketingConsentState,
} from '@/lib/services/loops';

// Shared by the dashboard Server Actions and /api/marketing-consent (plugin).
// Callers must pass the id of the authenticated user, never one from input.

async function getPrimaryEmail(userId: string): Promise<string | null> {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  return (
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null
  );
}

// null when it cannot be read (no email, Loops not configured, self-hosting):
// clients then show nothing rather than a prompt they cannot save.
export async function getMarketingConsentForUser(
  userId: string
): Promise<MarketingConsentState | null> {
  try {
    const email = await getPrimaryEmail(userId);
    if (!email) return null;
    return await getLoopsMarketingConsent(email);
  } catch (error) {
    console.error('Error reading marketing consent:', error);
    return null;
  }
}

export async function setMarketingConsentForUser(
  userId: string,
  optIn: boolean
): Promise<boolean> {
  try {
    const email = await getPrimaryEmail(userId);
    if (!email) return false;
    await setLoopsMarketingConsent(email, optIn);
    return true;
  } catch (error) {
    console.error('Error saving marketing consent:', error);
    return false;
  }
}
