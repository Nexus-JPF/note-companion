'use server';
import { auth } from '@clerk/nextjs/server';
import { Unkey } from '@unkey/api';
import { db, UserUsageTable as UserUsageTableImport } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

import { checkUserSubscriptionStatus } from '../drizzle/schema';

export async function isPaidUser(userId: string) {
  try {
    const isSubscribed = await checkUserSubscriptionStatus(userId);
    return isSubscribed;
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return false;
  }
}

export async function createLicenseKeyFromUserId(userId: string) {
  const token = process.env.UNKEY_ROOT_KEY;
  const apiId = process.env.UNKEY_API_ID;
  console.log(
    'Unkey configuration - Token exists:',
    !!token,
    'API ID exists:',
    !!apiId
  );

  if (!token || !apiId) {
    return null;
  }

  const name = 'my api key';
  // Unkey v2 uses 'rootKey' instead of 'token'
  const unkey = new Unkey({ rootKey: token });

  console.log('Creating Unkey license key', {
    apiId,
    ownerId: userId,
    name,
  });
  // Unkey v2 SDK - keys.create method
  // Type assertion needed as v2 types may differ
  const response = await (unkey as any).keys.create({
    name: name,
    ownerId: userId,
    apiId,
  });

  // Log the full response structure for debugging
  console.log('Unkey create response:', {
    hasResponse: !!response,
    responseKeys: response ? Object.keys(response) : [],
    hasData: response ? 'data' in response : false,
    hasResult: response ? 'result' in response : false,
    hasError: response ? 'error' in response : false,
    error: response?.error,
    fullResponse: JSON.stringify(response, null, 2),
  });

  // Handle v2 response format (wrapped in data) or v1 format (direct result)
  // Unkey can return: { data: { key: "...", keyId: "..." } } (v2) or { key: "...", keyId: "..." } (v1)
  const keyResult =
    response && ('data' in response ? response.data : response.result || response);

  if (response.error || !keyResult) {
    console.error('Failed to create license key', {
      error: response.error,
      hasKeyResult: !!keyResult,
      keyResult,
    });
    return null;
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
    return null;
  }

  console.log('License key created successfully', {
    keyResult,
    actualKey: actualKey ? actualKey.substring(0, 10) + '...' : 'missing',
    fullActualKey: typeof actualKey === 'string' ? actualKey : 'not a string',
    keyResultType: typeof keyResult,
    keyResultKeys: typeof keyResult === 'object' ? Object.keys(keyResult) : [],
  });

  // Return the key in the format expected by the frontend
  return {
    key: typeof actualKey === 'string' ? { key: actualKey } : keyResult,
  };
}

export async function createLicenseKey() {
  'use server';
  const { userId } = await auth();
  console.log('Creating license key - User authenticated:', !!userId);
  if (!userId) {
    return null;
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
