import { createWebhookHandler } from '../handler-factory';
import { CustomerData, } from "../types";
import { db, UserUsageTable } from "@/drizzle/schema";
import { sql } from "drizzle-orm";
import { updateUserSubscriptionData } from "../utils";
import Stripe from "stripe";


async function handleTopUp(userId: string, tokens: number,) {
  console.log("Handling top-up for user", userId, "with", tokens, "tokens");

  await db
    .insert(UserUsageTable)
    .values({
      userId,
      maxTokenUsage: tokens,
      tokenUsage: 0,
      audioTranscriptionMinutes: 0,
      maxAudioTranscriptionMinutes: 0, // Top-ups don't include audio transcription
      subscriptionStatus: 'active',
      paymentStatus: 'succeeded',
      currentProduct: 'top_up',
      currentPlan: 'top_up',
      billingCycle: 'top-up',
      lastPayment: new Date(),
    })
    .onConflictDoUpdate({
      target: [UserUsageTable.userId],
      set: {
        maxTokenUsage: sql`COALESCE(${UserUsageTable.maxTokenUsage}, 0) + ${tokens}`,
        lastPayment: new Date(),
        subscriptionStatus: 'active',
        paymentStatus: 'succeeded',
        // Don't reset audio transcription limits for top-ups
      },
    });
}



function createCustomerData(paymentIntent: Stripe.PaymentIntent): CustomerData {
  return {
    userId: paymentIntent.metadata?.userId,
    customerId: paymentIntent.customer?.toString() || "none",
    status: paymentIntent.status,
    billingCycle: "subscription",
    paymentStatus: paymentIntent.status,
    product: "subscription",
    plan: "monthly",
    lastPayment: new Date(),
  };
}



export const handlePaymentIntentSucceeded = createWebhookHandler(
  async (event) => {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const userId = paymentIntent.metadata?.userId;
    const type = paymentIntent.metadata?.type;
    const tokens = parseInt(paymentIntent.metadata?.tokens || "0");

    if (type === "top_up") {
      await handleTopUp(userId, tokens);
      return {
        success: true,
        message: `Successfully processed top-up for ${userId}`,
      };
    }

    // Handle regular subscription payment
    const customerData = createCustomerData(paymentIntent);
    await updateUserSubscriptionData(customerData);

    return {
      success: true,
      message: `Successfully processed payment intent for ${userId}`,
    };
  },
  {
    requiredMetadata: ['userId'],
  }
);