'use server';
import { auth } from '@clerk/nextjs/server';
import { Unkey } from '@unkey/api';
import { db, UserUsageTable as UserUsageTableImport } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

import { checkUserSubscriptionStatus } from '../drizzle/schema';

export type CreateLicenseKeyResponse =
  | { error: string }
  | { key: { key: string } };

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

    // Log the full response structure for debugging
    console.log('Unkey create response:', {
      hasResponse: !!response,
      responseKeys: response ? Object.keys(response) : [],
      hasData: response ? 'data' in response : false,
      hasError: response ? 'error' in response : false,
      fullResponse: JSON.stringify(response, null, 2),
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
        response,
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
        keyResult,
        keyResultType: typeof keyResult,
        keyResultKeys:
          typeof keyResult === 'object' ? Object.keys(keyResult) : [],
      });
      return {
        error: 'Failed to create license key: Key not found in response',
      };
    }

    console.log('License key created successfully', {
      keyResult,
      actualKey: actualKey ? actualKey.substring(0, 10) + '...' : 'missing',
      fullActualKey: typeof actualKey === 'string' ? actualKey : 'not a string',
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
