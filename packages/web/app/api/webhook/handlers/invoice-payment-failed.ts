import { db, UserUsageTable } from "@/drizzle/schema";
import { createWebhookHandler } from "../handler-factory";
import { updateClerkMetadata } from "@/lib/services/clerk";
import { trackLoopsEvent } from "@/lib/services/loops";
import Stripe from "stripe";
import { eq } from "drizzle-orm";

export const handleInvoicePaymentFailed = createWebhookHandler(
  async (event) => {
    const invoice = event.data.object as Stripe.Invoice;
    const userId = invoice.metadata?.userId;

    if (!userId) {
      console.warn("No userId found in invoice metadata");
      return { success: true, message: "Skipped invoice without userId" };
    }
    // set user to inactive
    await db
      .update(UserUsageTable)
      .set({
        paymentStatus: "payment_failed",
        maxTokenUsage: 0,
        maxAudioTranscriptionMinutes: 0, // Reset to 0 when payment fails
      })
      .where(eq(UserUsageTable.userId, userId));

    await updateClerkMetadata({
      userId,
      customerId: invoice.customer?.toString() || "",
      status: "payment_failed",
      paymentStatus: invoice.status,
      product: "subscription",
      plan: "none",
      lastPayment: new Date(),
    });

    if (invoice.customer_email) {
      await trackLoopsEvent({
        email: invoice.customer_email,
        userId,
        eventName: "invoice_payment_failed",
        data: {
          amount: invoice.amount_due,
          status: invoice.status,
        },
      });
    }

    return {
      success: true,
      message: `Successfully processed failed payment for ${userId}`,
    };
  }
);
