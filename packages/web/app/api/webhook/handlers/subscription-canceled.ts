import { createWebhookHandler } from "../handler-factory";
import { CustomerData } from "../types";
import { updateClerkMetadata } from "@/lib/services/clerk";
import { updateLoopsContactBillingCycle } from "@/lib/services/loops";
import { db, UserUsageTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { updateUserSubscriptionData } from "../utils";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

function getSubscriptionProduct(subscription: any): string | null {
  const productKey =
    subscription.items?.data?.[0]?.price?.product?.metadata?.srm_product_key;
  return productKey || null;
}

function getSubscriptionPrice(subscription: any): string | null {
  return subscription.items?.data?.[0]?.price?.metadata?.srm_price_key || null;
}

async function deleteUserSubscriptionData(userId: string) {
  // Catalyst means "currently paying", so cancelling a subscription clears it.
  // A lifetime licence is a one-time purchase that outlives any subscription,
  // so an owner who cancels an older subscription keeps access.
  const [existing] = await db
    .select({ billingCycle: UserUsageTable.billingCycle })
    .from(UserUsageTable)
    .where(eq(UserUsageTable.userId, userId))
    .limit(1);
  const isLifetime = existing?.billingCycle === "lifetime";

  await db
    .update(UserUsageTable)
    .set({
      subscriptionStatus: "canceled",
      paymentStatus: "canceled",
      billingCycle: "none", // Set to 'none' when subscription is canceled to satisfy NOT NULL constraint
      ...(isLifetime ? {} : { hasCatalystAccess: false }),
    })
    .where(eq(UserUsageTable.userId, userId));
}

export const handleSubscriptionCanceled = createWebhookHandler(
  async (event: Stripe.CustomerSubscriptionDeletedEvent) => {
    const subscription = event.data.object;
    const userId = subscription.metadata?.userId;

    await deleteUserSubscriptionData(userId);

    const customerData: CustomerData = {
      userId,
      customerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      status: "canceled",
      paymentStatus: "canceled",
      billingCycle: "none", // Set to 'none' when subscription is canceled
      product: getSubscriptionProduct(subscription) || "none",
      plan: getSubscriptionPrice(subscription) || "none",
      lastPayment: new Date(),
    };

    await updateUserSubscriptionData(customerData);
    await updateClerkMetadata(customerData);

    const customer = await stripe.customers.retrieve(
      subscription.customer as string
    ) as Stripe.Customer;
    const email = typeof customer === "string" ? "" : customer.email ?? "";
    if (email) {
      await updateLoopsContactBillingCycle(email, "none", userId);
    }

    return {
      success: true,
      message: `Successfully processed cancellation for ${userId}`,
    };
  },
  {
    requiredMetadata: ["userId"],
  }
);
