import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhook } from "./verify";
import { handleSubscriptionUpdated } from "./handlers/subscription-updated";
import { handleSubscriptionCanceled } from "./handlers/subscription-canceled";
import { handleCheckoutComplete } from "./handlers/checkout-complete";
import { handleInvoicePaid } from "./handlers/invoice-paid";
import { handlePaymentIntentSucceeded } from "./handlers/payment-intent-succeeded";
import { handleInvoicePaymentFailed } from "./handlers/invoice-payment-failed";
import { validateWebhookMetadata } from "@/srm.config";
import { captureServerEvent } from "@/lib/server-analytics";
import { stripeEventToFunnelEvent } from "@/lib/stripe-funnel-events";

const HANDLERS = {
  "checkout.session.completed": handleCheckoutComplete,
  "customer.subscription.deleted": handleSubscriptionCanceled,
  "customer.subscription.updated": handleSubscriptionUpdated,
  "invoice.paid": handleInvoicePaid,
  "invoice.payment_succeeded": handleInvoicePaid, // Handle both old and new event names
  "invoice.payment_failed": handleInvoicePaymentFailed,
  // "payment_intent.succeeded": handlePaymentIntentSucceeded,
} as const;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const event = await verifyStripeWebhook(req);
    const handler = HANDLERS[event.type as keyof typeof HANDLERS];

    // Use the validateWebhookMetadata helper from srm.config
    // For invoice events, metadata might be in subscription_details.metadata instead
    const metadata = event.data.object.metadata;
    const isInvoiceEvent = event.type.startsWith('invoice.');

    // Skip metadata validation for invoice events as they may have metadata in subscription_details
    if (metadata && !isInvoiceEvent && !validateWebhookMetadata(metadata)) {
      console.warn(`Invalid metadata for event ${event.type}`);
      // Continue processing as some events may not need complete metadata
    }

    if (!handler) {
      console.log(`Unhandled webhook event type: ${event.type}`);
      return NextResponse.json({ message: `Unhandled event type: ${event.type}` }, { status: 200 });
    }

    const result = await handler(event);

    if (!result.success) {
      console.error({
        message: `Webhook ${event.type} processing failed`,
        error: result.error,
        eventId: event.id,
        duration: Date.now() - startTime,
      });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // Funnel analytics: only after the event was processed successfully
    const funnelEvent = stripeEventToFunnelEvent(event);
    if (funnelEvent) {
      await captureServerEvent(
        funnelEvent.event,
        funnelEvent.properties,
        funnelEvent.userId
      );
    }

    return NextResponse.json({
      message: result.message,
      duration: Date.now() - startTime,
    });

  } catch (error) {
    console.error({
      message: "Webhook processing error",
      error,
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
