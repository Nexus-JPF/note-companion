import { createWebhookHandler } from "../handler-factory";
import { db, UserUsageTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { trackLoopsEvent } from "@/lib/services/loops";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

async function resetUserUsageAndSetLastPayment(userId: string) {
  console.log("resetUserUsageAndSetLastPayment", userId);
  // Reset usage to 0 but set max tokens and audio transcription to monthly allotment
  // This replaces the token balance on renewal (not additive)
  await db
    .update(UserUsageTable)
    .set({
      tokenUsage: 0,
      maxTokenUsage: 5000 * 1000, // 5M tokens per month
      audioTranscriptionMinutes: 0,
      maxAudioTranscriptionMinutes: 300, // 300 minutes per month for paid users
      lastPayment: new Date(),
    })
    .where(eq(UserUsageTable.userId, userId));
}



export const handleInvoicePaid = createWebhookHandler(
  async (event) => {
    const invoice = event.data.object as Stripe.Invoice;
    console.log("invoice paid", invoice);
    if (!invoice.subscription_details) {
      return {
        success: false,
        message: "No subscription details found",
      };
    }
    const metadata = invoice.subscription_details.metadata;

    // Note: This sets (not adds) tokens - subscription renewals get fresh allotment
    // If we wanted additive behavior, we'd use sql`COALESCE(...) + 5000000`
    await db
      .insert(UserUsageTable)
      .values({
        userId: metadata?.userId,
        subscriptionStatus: invoice.status,
        paymentStatus: invoice.status,
        billingCycle: metadata?.type as
          | "monthly"
          | "yearly"
          | "lifetime",
        maxTokenUsage: 5000 * 1000, // Reset to 5M tokens (not additive)
        maxAudioTranscriptionMinutes: 300, // 300 minutes per month for paid users
        lastPayment: new Date(),
        currentProduct: metadata?.product,
        currentPlan: metadata?.plan,
      })
      .onConflictDoUpdate({
        target: [UserUsageTable.userId],
        set: {
          subscriptionStatus: invoice.status,
          paymentStatus: invoice.status,
          maxTokenUsage: 5000 * 1000, // Reset to 5M tokens (not additive)
          maxAudioTranscriptionMinutes: 300, // 300 minutes per month for paid users
          billingCycle: metadata?.type as
            | "monthly"
            | "yearly"
            | "lifetime",
          lastPayment: new Date(),
          currentProduct: metadata?.product,
          currentPlan: metadata?.plan,
        },
      });

    await resetUserUsageAndSetLastPayment(invoice.metadata?.userId);

    await trackLoopsEvent({
      email: invoice.customer_email || "",
      userId: invoice.metadata?.userId,
      eventName: "invoice_paid",
      data: {
        amount: invoice.amount_paid,
        product:
          invoice.lines.data[0].price?.metadata?.srm_product_key || "default",
        plan: invoice.lines.data[0].price?.metadata?.srm_price_key || "default",
      },
    });

    return {
      success: true,
      message: "Invoice paid",
    };
  },
  {
    requiredMetadata: [],
  }
);
