import type Stripe from 'stripe';

export type FunnelEvent = {
  userId: string;
  event: string;
  properties: Record<string, string | number | boolean | null>;
};

type Metadata = Record<string, string> | null | undefined;

function userIdFrom(...sources: Metadata[]): string | undefined {
  for (const metadata of sources) {
    if (metadata?.userId) return metadata.userId;
  }
  return undefined;
}

function intervalOf(subscription: Stripe.Subscription): string | null {
  return subscription.items?.data?.[0]?.price?.recurring?.interval ?? null;
}

/**
 * Maps a verified Stripe webhook event to a first-run funnel event, or null
 * when the event is not part of the funnel or its user cannot be identified.
 *
 * Funnel meaning:
 * - `subscription_started`: checkout finished (a trial or a paid start).
 * - `invoice_paid`: `paid` is true only when money was collected, so a $0
 *   trial invoice has `paid: false` and the first real charge has `paid: true`.
 * - `invoice_payment_failed`: a charge was declined (for example at trial end).
 * - `subscription_canceled`: with the cancellation reason and whether it
 *   happened during the trial.
 */
export function stripeEventToFunnelEvent(event: {
  type: string;
  data: { object: unknown };
}): FunnelEvent | null {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') return null;
      const userId = userIdFrom(session.metadata);
      if (!userId) return null;
      return {
        userId,
        event: 'subscription_started',
        properties: { mode: session.mode },
      };
    }

    case 'invoice.paid':
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice & {
        parent?: {
          subscription_details?: { metadata?: Record<string, string> };
        } | null;
      };
      const userId = userIdFrom(
        invoice.parent?.subscription_details?.metadata,
        invoice.subscription_details?.metadata,
        invoice.metadata
      );
      if (!userId) return null;
      return {
        userId,
        event: 'invoice_paid',
        properties: {
          paid: (invoice.amount_paid ?? 0) > 0,
          amount_paid: invoice.amount_paid ?? 0,
          billing_reason: invoice.billing_reason ?? null,
        },
      };
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice & {
        parent?: {
          subscription_details?: { metadata?: Record<string, string> };
        } | null;
      };
      const userId = userIdFrom(
        invoice.parent?.subscription_details?.metadata,
        invoice.subscription_details?.metadata,
        invoice.metadata
      );
      if (!userId) return null;
      return {
        userId,
        event: 'invoice_payment_failed',
        properties: {
          billing_reason: invoice.billing_reason ?? null,
          attempt_count: invoice.attempt_count ?? 0,
        },
      };
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = userIdFrom(subscription.metadata);
      if (!userId) return null;
      const canceledAt = subscription.canceled_at ?? null;
      const trialEnd = subscription.trial_end ?? null;
      return {
        userId,
        event: 'subscription_canceled',
        properties: {
          reason: subscription.cancellation_details?.reason ?? null,
          feedback: subscription.cancellation_details?.feedback ?? null,
          during_trial:
            trialEnd !== null && canceledAt !== null && canceledAt <= trialEnd,
          interval: intervalOf(subscription),
        },
      };
    }

    default:
      return null;
  }
}
