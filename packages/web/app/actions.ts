'use server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import {
  createLicenseKeyFromUserId,
  getLicenseKeyFromUserId,
  getUserBillingCycleForUser,
  isPaidUserForUser,
  type CreateLicenseKeyResponse,
  type GetLicenseKeyResponse,
} from '@/lib/account-server';
import {
  getLoopsMarketingConsent,
  setLoopsMarketingConsent,
  type MarketingConsentState,
} from '@/lib/services/loops';

// Server Actions: every export here is callable from the browser, so each one
// acts only for the signed-in Clerk user and never takes a user id argument.
// Functions that take a user id live in lib/account-server.ts (server-only).

export async function isPaidUser(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  return isPaidUserForUser(userId);
}

export async function createLicenseKey(): Promise<CreateLicenseKeyResponse> {
  const { userId } = await auth();
  console.log('Creating license key - User authenticated:', !!userId);
  if (!userId) {
    return {
      error: 'User not authenticated. Please log in and try again.',
    };
  }
  return createLicenseKeyFromUserId(userId);
}

export async function getLicenseKey(): Promise<GetLicenseKeyResponse> {
  const { userId } = await auth();
  if (!userId) {
    return {
      error: 'User not authenticated. Please log in and try again.',
    };
  }
  return getLicenseKeyFromUserId(userId);
}

export async function getUserBillingCycle() {
  const { userId } = await auth();
  return getUserBillingCycleForUser(userId ?? '');
}

async function getPrimaryEmail(userId: string): Promise<string | null> {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(userId);
  return (
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null
  );
}

// null when it cannot be read (signed out, no email, Loops not configured):
// the UI then shows nothing rather than a prompt it cannot save.
export async function getMarketingConsent(): Promise<MarketingConsentState | null> {
  const { userId } = await auth();
  if (!userId) return null;
  try {
    const email = await getPrimaryEmail(userId);
    if (!email) return null;
    return await getLoopsMarketingConsent(email);
  } catch (error) {
    console.error('Error reading marketing consent:', error);
    return null;
  }
}

export async function setMarketingConsent(
  optIn: boolean
): Promise<{ success: boolean }> {
  const { userId } = await auth();
  if (!userId || typeof optIn !== 'boolean') return { success: false };
  try {
    const email = await getPrimaryEmail(userId);
    if (!email) return { success: false };
    await setLoopsMarketingConsent(email, optIn);
    return { success: true };
  } catch (error) {
    console.error('Error saving marketing consent:', error);
    return { success: false };
  }
}
