import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getToken, handleAuthorizationV2 } from "@/lib/handleAuthorization";
import { createAnonymousUser } from "../anon";
import { createLicenseKeyFromUserId } from "@/app/actions";
import { createEmptyUserUsage, db, UserUsageTable } from "@/drizzle/schema";
import { config,  PRICES } from "@/srm.config";
import { getUrl } from "@/lib/getUrl";
import { sql } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
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
    console.error("Failed to create fallback user:", error);
    throw new Error("Unable to create or authorize user");
  }
}

async function ensureAuthorizedUser(req: NextRequest) {
  const initialLicenseKey = getToken(req);

  try {
    const { userId } = await handleAuthorizationV2(req);
    return { userId, licenseKey: initialLicenseKey };
  } catch (error) {
    console.log("Authorization failed, creating anonymous user:", error);
    return createFallbackUser();
  }
}

// Development-only function to add tokens directly to a user account
async function devTopUpTokens(userId: string, tokens: number) {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Dev top-up only available in development environment");
  }

  console.log(`DEV: Adding ${tokens} tokens for user ${userId}`);

  // Update user's token balance
  await db
    .insert(UserUsageTable)
    .values({
      userId,
      maxTokenUsage: tokens,
      tokenUsage: 0,
      subscriptionStatus: 'active',
      paymentStatus: 'succeeded',
      currentProduct: 'dev_top_up',
      currentPlan: 'dev_top_up',
      billingCycle: 'dev-top-up',
      lastPayment: new Date(),
    })
    .onConflictDoUpdate({
      target: [UserUsageTable.userId],
      set: {
        maxTokenUsage: sql`COALESCE(${UserUsageTable.maxTokenUsage}, 0) + ${tokens}`,
        lastPayment: new Date(),
        subscriptionStatus: 'active',
        paymentStatus: 'succeeded',
      },
    });

  return {
    success: true,
    message: `Added ${tokens} tokens to user ${userId}`,
    tokens
  };
}

export async function POST(req: NextRequest) {
  let userId, licenseKey;

  try {
    ({ userId, licenseKey } = await ensureAuthorizedUser(req));
  } catch (error) {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  }

  const baseUrl = getUrl();
  console.log("baseUrl", baseUrl);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    payment_intent_data: {
      metadata: {
        userId,
        type: config.products.PayOnceTopUp.metadata.type,
        plan: config.products.PayOnceTopUp.metadata.plan,
        tokens: "5000000", // 5M tokens
      },
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "5M Tokens Top-up",
            description: "One-time purchase of 5M additional tokens",
          },
          unit_amount: PRICES.TOP_UP,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${baseUrl}/top-up-success`,
    cancel_url: `${baseUrl}/top-up-cancelled`,
    allow_promotion_codes: true,
    metadata: {
      userId,
      type: config.products.PayOnceTopUp.metadata.type,
      plan: config.products.PayOnceTopUp.metadata.plan,
      tokens: "5000000", // 5M tokens
    },
  });

  return NextResponse.json({ url: session.url, licenseKey });
}

// Development-only endpoint to add tokens directly (no payment required)
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
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Dev top-up only available in development environment" },
      { status: 403 }
    );
  }

  let userId, licenseKey;

  try {
    ({ userId, licenseKey } = await ensureAuthorizedUser(req));
  } catch (error) {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  }

  try {
    // Get params from URL for GET or body for PATCH
    let tokens = 1000000; // Default
    let devSecret = null;

    if (req.method === 'PATCH') {
      try {
        const data = await req.json();
        tokens = parseInt(data.tokens || "1000000");
        devSecret = data.devSecret;
      } catch (e) {
        // If JSON parsing fails, fall back to URL params
        const url = new URL(req.url);
        tokens = parseInt(url.searchParams.get('tokens') || "1000000");
        devSecret = url.searchParams.get('devSecret');
      }
    } else {
      // For GET requests, use URL parameters
      const url = new URL(req.url);
      tokens = parseInt(url.searchParams.get('tokens') || "1000000");
      devSecret = url.searchParams.get('devSecret');
    }

    // Optional additional security
    if (process.env.DEV_SECRET && devSecret !== process.env.DEV_SECRET) {
      return NextResponse.json(
        { error: "Invalid dev secret" },
        { status: 403 }
      );
    }

    const result = await devTopUpTokens(userId, tokens);

    return NextResponse.json({
      ...result,
      userId,
      licenseKey
    });
  } catch (error) {
    console.error("Error in dev top-up:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
