'use server';
import { auth } from '@clerk/nextjs/server';
import { Unkey } from '@unkey/api';
import { listUnkeyKeysForOwner } from '@/lib/unkey-client';
import { db, UserUsageTable as UserUsageTableImport } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

import { checkUserSubscriptionStatus } from '../drizzle/schema';

export type CreateLicenseKeyResponse =
  | { error: string }
  | { key: { key: string } };

export type GetLicenseKeyResponse =
  | { error: string }
  | { key: string | null };

export async function isPaidUser(userId: string) {
  try {
    const isSubscribed = await checkUserSubscriptionStatus(userId);
    return isSubscribed;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
}

export async function createLicenseKeyFromUserId(
  userId: string
): Promise<CreateLicenseKeyResponse> {
  const token = process.env.UNKEY_ROOT_KEY;
  const apiId = process.env.UNKEY_API_ID;
  console.log(
    'Unkey configuration - Token exists:',
    !!token,
    'API ID exists:',
    !!apiId
  );

  if (!token || !apiId) {
    console.error('Unkey configuration missing', {
      hasToken: !!token,
      hasApiId: !!apiId,
    });
    return {
      error: 'Unkey configuration is missing. Please contact support.',
    };
  }

  const name = 'my api key';
  // Unkey v2 uses 'rootKey' instead of 'token'
  const unkey = new Unkey({ rootKey: token });

  console.log('Creating Unkey license key', {
    apiId,
    externalId: userId,
    name,
  });

  try {
    // Unkey v2 SDK - keys.createKey method
    const response = await unkey.keys.createKey({
      name: name,
      externalId: userId,
      apiId,
    });

    // Log the response shape only: the response contains the license key itself
    console.log('Unkey create response:', {
      hasResponse: !!response,
      responseKeys: response ? Object.keys(response) : [],
      hasData: response ? 'data' in response : false,
      hasError: response ? 'error' in response : false,
    });

    // Check for error in response (using type assertion since SDK types may not include error)
    const responseWithError = response as {
      error?: unknown;
      data?: { key: string; keyId: string };
    };
    if (responseWithError?.error) {
      console.error('Unkey API returned an error:', responseWithError.error);
      return {
        error: `Failed to create license key: ${JSON.stringify(
          responseWithError.error
        )}`,
      };
    }

    // Unkey v2 response format: { data: { key: "...", keyId: "..." } }
    const keyResult = responseWithError?.data;

    if (!keyResult) {
      console.error('Failed to create license key - no data in response', {
        hasKeyResult: !!keyResult,
        responseKeys: response ? Object.keys(response) : [],
      });
      return {
        error: 'Failed to create license key: No data in response',
      };
    }

    // Unkey returns { key: "actual_key_string", keyId: "...", ... }
    // The key field contains the actual API key string
    // Extract the actual key string - it should be in keyResult.key
    const actualKey = keyResult.key;

    if (!actualKey || typeof actualKey !== 'string') {
      console.error('Key not found in response', {
        keyResultType: typeof keyResult,
        keyResultKeys:
          typeof keyResult === 'object' ? Object.keys(keyResult) : [],
      });
      return {
        error: 'Failed to create license key: Key not found in response',
      };
    }

    // Never log the key or any part of it
    console.log('License key created successfully', {
      keyId: keyResult.keyId,
      keyLength: actualKey.length,
      keyResultType: typeof keyResult,
      keyResultKeys:
        typeof keyResult === 'object' ? Object.keys(keyResult) : [],
    });

    // Return the key in the format expected by the frontend
    return {
      key: typeof actualKey === 'string' ? { key: actualKey } : keyResult,
    };
  } catch (error) {
    console.error('Exception while creating license key:', error);
    return {
      error: `Failed to create license key: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
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

export async function getLicenseKeyFromUserId(
  userId: string
): Promise<GetLicenseKeyResponse> {
  const token = process.env.UNKEY_ROOT_KEY;
  const apiId = process.env.UNKEY_API_ID;

  if (!token || !apiId) {
    return {
      error: 'Unkey configuration is missing. Please contact support.',
    };
  }

  try {
    const keys = await listUnkeyKeysForOwner(userId, apiId, token);

    if (keys.length > 0) {
      // Since Unkey doesn't return the actual key string when listing,
      // we'll return a flag indicating a key exists
      // The user will need to use the key they already have
      return {
        key: null, // We can't retrieve the actual key string for security reasons
      };
    }

    // No keys found
    return { key: null };
  } catch (error) {
    console.error('Error fetching license key:', error);
    // If we can't determine if a key exists, assume none exists
    // This allows users to create a new key
    return { key: null };
  }
}

export async function getUserBillingCycle(userId: string) {
  if (!userId) return 'none'; // Default to monthly if no userId

  try {
    const user = await db
      .select({ billingCycle: UserUsageTableImport.billingCycle })
      .from(UserUsageTableImport)
      .where(eq(UserUsageTableImport.userId, userId))
      .limit(1);

    return user[0]?.billingCycle || 'none'; // Default to monthly if not found
  } catch (error) {
    console.error('Error fetching user billing cycle:', error);
    return 'none'; // Default to monthly in case of error
  }
}
