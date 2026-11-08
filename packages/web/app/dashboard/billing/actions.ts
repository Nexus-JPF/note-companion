"use server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { getUrl } from "@/lib/getUrl";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const FALLBACK_URL = process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL;

async function findStripeCustomerId(userId: string): Promise<string | null> {
  // Fast path: written to Clerk metadata by the subscription webhooks.
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const fromClerk = (user.publicMetadata as { stripe?: { customerId?: unknown } })
    .stripe?.customerId;
  if (typeof fromClerk === "string" && fromClerk.startsWith("cus_")) {
    return fromClerk;
  }

  // Fallback for users whose metadata predates the webhook write.
  const subs = await stripe.subscriptions.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });
  const customer = subs.data[0]?.customer;
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

/**
 * Returns a URL to the Stripe billing portal for the signed-in user (no email
 * login step). Falls back to the generic portal link if we can't resolve a
 * Stripe customer, so users always have a way to cancel.
 */
export async function getBillingPortalUrl(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const customerId = await findStripeCustomerId(userId);
    if (!customerId) return FALLBACK_URL ?? null;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getUrl()}dashboard/settings`,
    });
    return session.url;
  } catch (err) {
    console.error("getBillingPortalUrl:", err);
    return FALLBACK_URL ?? null;
  }
}
