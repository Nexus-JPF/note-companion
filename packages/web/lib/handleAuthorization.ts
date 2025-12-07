import { clerkClient, auth } from '@clerk/nextjs/server';
import { Unkey } from '@unkey/api';
import { NextRequest } from 'next/server';
import {
  checkTokenUsage,
  checkUserSubscriptionStatus,
  createEmptyUserUsage,
  UserUsageTable,
  db,
  initializeTierConfig,
  isSubscriptionActive,
} from '../drizzle/schema';
import PostHogClient from './posthog';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * @deprecated This function is being deprecated in favor of a new authorization method.
 * Please use the new handleAuthorizationV2 function instead.
 */
async function handleLogging(
  req: NextRequest,
  userId: string,
  isCustomer: boolean
) {
  const authClient = await clerkClient();
  const user = await authClient.users.getUser(userId);
  const client = PostHogClient();
  if (client) {
    client.capture({
      distinctId: userId,
      event: 'call-api',
      properties: {
        endpoint: req.nextUrl.pathname.replace('/api/', ''),
        isCustomer,
        email: user?.emailAddresses[0]?.emailAddress,
      },
    });
  }
}

async function handleLoggingV2(req: NextRequest, userId: string) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  console.log('user', user.emailAddresses[0]?.emailAddress);
  const posthogClient = PostHogClient();
  if (posthogClient) {
    posthogClient.capture({
      distinctId: userId,
      event: 'call-api',
      properties: {
        endpoint: req.nextUrl.pathname.replace('/api/', ''),
        email: user?.emailAddresses[0]?.emailAddress,
      },
    });
  }
}

class AuthorizationError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthorizationError';
    this.status = status;
  }
}

export const getToken = (req: NextRequest) => {
  const header = req.headers.get('authorization');
  const token = header?.replace('Bearer ', '');
  return token;
};

// Make sure tier configurations exist
let tierConfigInitialized = false;
async function ensureTierConfigExists(): Promise<void> {
  if (tierConfigInitialized) return;

  try {
    await initializeTierConfig();
    tierConfigInitialized = true;
    console.log('Tier configuration initialized');
  } catch (error) {
    console.error('Error initializing tier configuration:', error);
  }
}

// Helper function to check if user exists and initialize if not

interface AuthContext {
  requestId: string;
  path: string;
  method: string;
}

function createLogger(context: AuthContext) {
  return {
    info: (message: string, extra = {}) => {
      console.log(
        JSON.stringify({
          level: 'info',
          message,
          ...context,
          ...extra,
          timestamp: new Date().toISOString(),
        })
      );
    },
    error: (message: string, error: unknown, extra = {}) => {
      // Determine if error is an instance of Error to safely access message/stack
      const errorDetails =
        error instanceof Error
          ? { error: error.message, stack: error.stack }
          : { error: 'Unknown error object' };

      console.error(
        JSON.stringify({
          level: 'error',
          message,
          ...errorDetails,
          ...context,
          ...extra,
          timestamp: new Date().toISOString(),
        })
      );
    },
  };
}

// Helper functions for authentication flows
async function handleApiKeyAuth(
  token: string,
  logger: ReturnType<typeof createLogger>
) {
  logger.info('Attempting API key authentication');

  // Unkey v2: verifyKey is a method on the Unkey instance
  // It takes an object with 'key' property
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
    logger.error('API key validation failed', error, { code: result?.code });
    return null;
  }

  logger.info('API key authentication successful', { ownerId: result.ownerId });
  return result.ownerId;
}

async function handleClerkAuth(logger: ReturnType<typeof createLogger>) {
  logger.info('Attempting Clerk authentication');
  const { userId } = await auth();

  if (!userId) {
    logger.error('Clerk authentication failed', null);
    return null;
  }

  logger.info('Clerk authentication successful', { userId });
  return userId;
}

// Helper functions for user validation
async function validateSubscription(
  userId: string,
  logger: ReturnType<typeof createLogger>
) {
  logger.info('Validating user subscription', { userId });
  const isActive = await isSubscriptionActive(userId);

  if (!isActive) {
    logger.info('Subscription inactive', { userId });
    throw new AuthorizationError('Subscription inactive', 403);
  }

  return true;
}

async function validateTokenUsage(
  userId: string,
  logger: ReturnType<typeof createLogger>
) {
  logger.info('Checking token usage', { userId });
  const { remaining, usageError } = await checkTokenUsage(userId);

  if (usageError) {
    logger.error('Token usage check failed', { error: 'Database error' });
    throw new AuthorizationError('Usage check failed', 500);
  }

  if (remaining <= 0) {
    // Get the user's current usage and limits for better error reporting
    const userUsage = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, userId))
      .limit(1);

    const usage = userUsage.length > 0 ? userUsage[0].tokenUsage : 0;
    const limit = userUsage.length > 0 ? userUsage[0].maxTokenUsage : 0;

    logger.info('Token limit exceeded', { userId, remaining, usage, limit });
    throw new AuthorizationError(
      `Token limit exceeded. Used ${usage}/${limit} tokens. Please upgrade your plan for more tokens.`,
      429
    );
  }

  return { remaining };
}

export async function handleAuthorizationV2(req: NextRequest) {
  const requestId = nanoid();
  const context: AuthContext = {
    requestId,
    path: req.nextUrl.pathname,
    method: req.method,
  };
  const logger = createLogger(context);

  logger.info('Starting authorization process');

  // Skip auth if user management is disabled
  if (process.env.ENABLE_USER_MANAGEMENT !== 'true') {
    logger.info('User management disabled, returning default user');
    return { userId: 'user', isCustomer: true };
  }

  try {
    // Try API key auth first
    const token = getToken(req);
    if (token) {
      const userId = await handleApiKeyAuth(token, logger);
      if (userId) {
        // Validate user access - separated subscription and token checks
        try {
          await ensureUserExists(userId);

          // First check subscription
          await validateSubscription(userId, logger);

          // Then check token usage
          const { remaining } = await validateTokenUsage(userId, logger);

          logger.info('Authorization successful via API key', {
            userId,
            remaining,
          });
          await handleLoggingV2(req, userId);
          return { userId };
        } catch (error) {
          logger.error('User validation failed', error, { userId });
          throw error;
        }
      }
    }

    // Fall back to Clerk auth
    const userId = await handleClerkAuth(logger);
    if (userId) {
      // Validate user access with separated concerns
      try {
        await ensureUserExists(userId);

        // First check subscription
        await validateSubscription(userId, logger);

        // Then check token usage
        const { remaining } = await validateTokenUsage(userId, logger);

        logger.info('Authorization successful via Clerk', {
          userId,
          remaining,
        });
        await handleLoggingV2(req, userId);
        return { userId };
      } catch (error) {
        logger.error('User validation failed', error, { userId });
        throw error;
      }
    }

    logger.error('All authentication methods failed', null);
    throw new AuthorizationError('Unauthorized', 401);
  } catch (error) {
    // Log the full error but return a sanitized version
    logger.error(
      'Authorization failed',
      error instanceof Error ? error : new Error('Unknown error')
    );
    if (error instanceof AuthorizationError) {
      throw error;
    }
    throw new AuthorizationError('Internal server error', 500);
  }
}

/**
 * @deprecated This function is being deprecated in favor of a new authorization method.
 * Please use the new handleAuthorizationV2 function instead.
 */
export async function handleAuthorization(req: NextRequest) {
  // this is to allow people to self host it easily without
  // setting up clerk
  if (process.env.ENABLE_USER_MANAGEMENT !== 'true') {
    return { userId: 'user', isCustomer: true };
  }

  const header = req.headers.get('authorization');
  const { url, method } = req;
  console.log({ url, method });

  if (!header) {
    throw new AuthorizationError('No Authorization header', 401);
  }

  const token = header.replace('Bearer ', '');

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

  if (!result || !result.valid) {
    console.error(result);
    throw new AuthorizationError(`Unauthorized: ${result?.code}`, 401);
  }

  // Check subscription status
  const isActive = await checkUserSubscriptionStatus(result.ownerId);
  if (!isActive) {
    throw new AuthorizationError('Subscription canceled or inactive', 403);
  }

  // Check token usage
  const { remaining, usageError } = await checkTokenUsage(result.ownerId);
  console.log('remaining', remaining);

  if (usageError) {
    throw new AuthorizationError('Error checking token usage', 500);
  }

  if (remaining <= 0) {
    throw new AuthorizationError(
      'Credits limit exceeded. Top up your credits in settings.',
      429
    );
  }

  await handleLogging(req, result.ownerId, false);

  return { userId: result.ownerId };
}
async function ensureUserExists(userId: string): Promise<void> {
  try {
    // Make sure tier configuration exists first
    await ensureTierConfigExists();

    // Check if user exists in the database
    const userUsage = await db
      .select()
      .from(UserUsageTable)
      .where(eq(UserUsageTable.userId, userId))
      .limit(1);

    // If no user record exists, create one with legacy plan
    if (!userUsage.length) {
      console.log(
        `User ${userId} not found in database, initializing with legacy plan`
      );
      await createEmptyUserUsage(userId);
    }
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    throw new AuthorizationError(
      `Failed to initialize user account: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      500
    );
  }
}
