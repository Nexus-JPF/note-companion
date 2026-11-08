'use server';
import { auth } from '@clerk/nextjs/server';
import {
  createLicenseKeyFromUserId,
  getLicenseKeyFromUserId,
  getUserBillingCycleForUser,
  isPaidUserForUser,
  type CreateLicenseKeyResponse,
  type GetLicenseKeyResponse,
} from '@/lib/account-server';

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
