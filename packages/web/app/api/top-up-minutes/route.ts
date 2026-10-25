import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getToken, handleAuthorizationV2 } from '@/lib/handleAuthorization';
import { createAnonymousUser } from '../anon';
import { createLicenseKeyFromUserId } from '@/app/actions';
import { createEmptyUserUsage, db, UserUsageTable } from '@/drizzle/schema';
import { config, PRICES } from '@/srm.config';
import { getUrl } from '@/lib/getUrl';
import { sql } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

async function createFallbackUser() {
  try {
    const user = await createAnonymousUser();
    await createEmptyUserUsage(user.id);
    const licenseKeyResult = await createLicenseKeyFromUserId(user.id);

    if ('error' in licenseKeyResult) {
      throw new Error(licenseKeyResult.error);
    }

    return { userId: user.id, licenseKey: licenseKeyResult.key.key };
  } catch (error) {
    console.error('Failed to create fallback user:', error);
    throw new Error('Unable to create or authorize user');
  }
}

async function ensureAuthorizedUser(req: NextRequest) {
  const initialLicenseKey = getToken(req);

  // Check if key is obviously invalid before attempting auth
  if (initialLicenseKey && initialLicenseKey.trim().length < 10) {
    console.warn('Invalid API key format detected - too short', {
      keyLength: initialLicenseKey.trim().length,
    });
    // Still create fallback user for top-up flow, but log the issue
    // Frontend validation should prevent this, but handle gracefully on server
  }

  try {
    const { userId } = await handleAuthorizationV2(req);
    return {
      userId,
      licenseKey: initialLicenseKey,
      wasAnonymousUserCreated: false,
      hadInvalidKey: false,
    };
  } catch (error) {
    // Log detailed information about the auth failure
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStatus =
      error instanceof Error && 'status' in error
        ? (error as { status: number }).status
        : 'unknown';

    console.log('Authorization failed, creating anonymous user:', {
      error: errorMessage,
      status: errorStatus,
      hadLicenseKey: !!initialLicenseKey,
      keyLength: initialLicenseKey?.trim().length || 0,
      path: req.nextUrl.pathname,
    });

    // If a license key was provided but auth failed, log a warning
    if (initialLicenseKey) {
      const isInvalidFormat = initialLicenseKey.trim().length < 10;
      console.warn(
        'License key provided but authentication failed - creating anonymous user as fallback',
        {
          keyLength: initialLicenseKey.trim().length,
          isInvalidFormat,
          error: errorMessage,
        }
      );
    }

    const fallbackResult = await createFallbackUser();

    // Return result with a flag indicating if anonymous user was created due to invalid key
    return {
      ...fallbackResult,
      wasAnonymousUserCreated: true,
      hadInvalidKey: !!initialLicenseKey && initialLicenseKey.trim().length < 10,
    };
  }
}

// Development-only function to add minutes directly to a user account
async function devTopUpMinutes(userId: string, minutes: number) {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Dev top-up only available in development environment');
  }

  console.log(`DEV: Adding ${minutes} minutes for user ${userId}`);

  // Update user's minutes balance
  await db
    .insert(UserUsageTable)
    .values({
      userId,
      maxTokenUsage: 0,
      tokenUsage: 0,
      audioTranscriptionMinutes: 0,
      maxAudioTranscriptionMinutes: minutes,
      subscriptionStatus: 'active',
      paymentStatus: 'succeeded',
      currentProduct: 'dev_top_up_minutes',
      currentPlan: 'dev_top_up_minutes',
      billingCycle: 'dev-top-up-minutes',
      lastPayment: new Date(),
    })
    .onConflictDoUpdate({
      target: [UserUsageTable.userId],
      set: {
        maxAudioTranscriptionMinutes: sql`COALESCE(${UserUsageTable.maxAudioTranscriptionMinutes}, 0) + ${minutes}`,
        lastPayment: new Date(),
        subscriptionStatus: 'active',
        paymentStatus: 'succeeded',
        // Don't reset token limits for dev top-ups
      },
    });

  return {
    success: true,
    message: `Added ${minutes} minutes to user ${userId}`,
    minutes,
  };
}

export async function POST(req: NextRequest) {
  let userId, licenseKey, wasAnonymousUserCreated, hadInvalidKey;

  try {
    ({ userId, licenseKey, wasAnonymousUserCreated, hadInvalidKey } = await ensureAuthorizedUser(req));
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }

  const baseUrl = getUrl();
  console.log('baseUrl', baseUrl);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    payment_intent_data: {
      metadata: {
        userId,
        type: 'top_up_minutes', // Used by payment-intent-succeeded handler
        plan: config.products.PayOnceTopUpMinutes.metadata.plan,
        minutes: '300', // 300 minutes
      },
    },
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: '300 Minutes Top-up',
            description: 'One-time purchase of 300 additional transcription minutes',
          },
          unit_amount: PRICES.TOP_UP_MINUTES,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${baseUrl}/top-up-success`,
    cancel_url: `${baseUrl}/top-up-cancelled`,
    allow_promotion_codes: true,
    metadata: {
      userId,
      type: 'top_up_minutes', // Used by payment-intent-succeeded handler
      plan: config.products.PayOnceTopUpMinutes.metadata.plan, // Used by checkout-complete handler
      minutes: '300', // 300 minutes
    },
  });

  return NextResponse.json({
    url: session.url,
    licenseKey,
    // Include metadata about anonymous user creation for client awareness
    ...(wasAnonymousUserCreated && {
      anonymousUserCreated: true,
      ...(hadInvalidKey && { invalidKeyDetected: true })
    })
  });
}

// Development-only endpoint to add minutes directly (no payment required)
// Supports both PATCH (for API calls) and GET (for browser access)
export async function PATCH(req: NextRequest) {
  return handleDevTopUp(req);
}

// GET endpoint for easy browser access
export async function GET(req: NextRequest) {
  return handleDevTopUp(req);
}

// Shared handler for both GET and PATCH
async function handleDevTopUp(req: NextRequest) {
  // Only allow in development environment
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Dev top-up only available in development environment' },
      { status: 403 }
    );
  }

  let userId, licenseKey;

  try {
    ({ userId, licenseKey } = await ensureAuthorizedUser(req));
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }

  try {
    // Get params from URL for GET or body for PATCH
    let minutes = 300; // Default
    let devSecret = null;

    if (req.method === 'PATCH') {
      try {
        const data = await req.json();
        minutes = parseInt(data.minutes || '300');
        devSecret = data.devSecret;
      } catch (e) {
        // If JSON parsing fails, fall back to URL params
        const url = new URL(req.url);
        minutes = parseInt(url.searchParams.get('minutes') || '300');
        devSecret = url.searchParams.get('devSecret');
      }
    } else {
      // For GET requests, use URL parameters
      const url = new URL(req.url);
      minutes = parseInt(url.searchParams.get('minutes') || '300');
      devSecret = url.searchParams.get('devSecret');
    }

    // Optional additional security
    if (process.env.DEV_SECRET && devSecret !== process.env.DEV_SECRET) {
      return NextResponse.json(
        { error: 'Invalid dev secret' },
        { status: 403 }
      );
    }

    const result = await devTopUpMinutes(userId, minutes);

    return NextResponse.json({
      ...result,
      userId,
      licenseKey,
    });
  } catch (error) {
    console.error('Error in dev top-up:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

