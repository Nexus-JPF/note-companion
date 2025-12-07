import { NextRequest, NextResponse } from 'next/server';
import { db, UserUsageTable } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getToken } from '@/lib/handleAuthorization';
import { Unkey } from '@unkey/api';

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request);

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 });
    }

    // Verify the key without checking for subscription status
    // Unkey v2: Use Unkey instance for verification
    const unkey = new Unkey({
      rootKey: process.env.UNKEY_ROOT_KEY || '',
    });

    // Try verifyKey method (v2 API) - takes object with 'key' property
    // Include apiId if available (keys are scoped to an API)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any = null;
    const apiId = process.env.UNKEY_API_ID;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifyParams: any = { key: token };
    if (apiId) {
      verifyParams.apiId = apiId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((unkey as any).keys?.verifyKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response = await (unkey as any).keys.verifyKey(verifyParams);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } else if ((unkey as any).verifyKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response = await (unkey as any).verifyKey(verifyParams);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } else if ((unkey as any).keys?.verify) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response = await (unkey as any).keys.verify(verifyParams);
    }

    // Handle v2 response format (wrapped in data) or v1 format (direct result)
    const result =
      response && ('data' in response ? response.data : response.result);
    const error = response?.error;

    if (!result || !result.valid) {
      return NextResponse.json(
        {
          error: 'Invalid key',
          message: 'Please provide a valid license key',
        },
        { status: 401 }
      );
    }

    // Extract userId from v2 format (identity.externalId) or v1 format (ownerId)
    const userId =
      result?.identity?.externalId || result?.identity?.id || result?.ownerId;
    if (!userId) {
      return NextResponse.json(
        {
          error: 'Invalid key',
          message: 'No user ID found in verification result',
        },
        { status: 401 }
      );
    }

    // Get basic usage information without checking subscription status
    const userUsage = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, userId))
      .limit(1);

    if (!userUsage.length) {
      // Return default values for new users
      return NextResponse.json({
        tokenUsage: 0,
        maxTokenUsage: 100000, // Default legacy plan tokens
        subscriptionStatus: 'inactive',
        currentPlan: 'Legacy Plan',
        isActive: false,
      });
    }

    return NextResponse.json({
      tokenUsage: userUsage[0].tokenUsage || 0,
      maxTokenUsage: userUsage[0].maxTokenUsage || 100000,
      subscriptionStatus: userUsage[0].subscriptionStatus || 'inactive',
      currentPlan: userUsage[0].currentPlan || 'Legacy Plan',
      isActive: userUsage[0].subscriptionStatus === 'active',
    });
  } catch (error) {
    console.error('Error fetching public usage data:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch usage data',
      },
      { status: 500 }
    );
  }
}
