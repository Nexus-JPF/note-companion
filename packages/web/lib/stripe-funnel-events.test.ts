import { stripeEventToFunnelEvent } from './stripe-funnel-events';

const ev = (type: string, object: unknown) => ({ type, data: { object } });

describe('stripeEventToFunnelEvent', () => {
  it('maps a subscription checkout to subscription_started', () => {
    expect(
      stripeEventToFunnelEvent(
        ev('checkout.session.completed', {
          mode: 'subscription',
          metadata: { userId: 'u1' },
        })
      )
    ).toEqual({
      userId: 'u1',
      event: 'subscription_started',
      properties: { mode: 'subscription' },
    });
  });

  it('ignores one-time payments (top-ups) and checkouts without a user', () => {
    expect(
      stripeEventToFunnelEvent(
        ev('checkout.session.completed', {
          mode: 'payment',
          metadata: { userId: 'u1' },
        })
      )
    ).toBeNull();
    expect(
      stripeEventToFunnelEvent(
        ev('checkout.session.completed', { mode: 'subscription', metadata: {} })
      )
    ).toBeNull();
  });

  it('marks a $0 trial invoice as not paid and a real charge as paid', () => {
    const trial = stripeEventToFunnelEvent(
      ev('invoice.paid', {
        amount_paid: 0,
        billing_reason: 'subscription_create',
        parent: { subscription_details: { metadata: { userId: 'u1' } } },
      })
    );
    expect(trial?.properties).toMatchObject({
      paid: false,
      billing_reason: 'subscription_create',
    });

    const charge = stripeEventToFunnelEvent(
      ev('invoice.paid', {
        amount_paid: 1500,
        billing_reason: 'subscription_cycle',
        metadata: { userId: 'u1' },
      })
    );
    expect(charge).toMatchObject({
      userId: 'u1',
      event: 'invoice_paid',
      properties: { paid: true, amount_paid: 1500 },
    });
  });

  it('counts a payment once: invoice.payment_succeeded is not mapped', () => {
    expect(
      stripeEventToFunnelEvent(
        ev('invoice.payment_succeeded', {
          amount_paid: 1500,
          metadata: { userId: 'u1' },
        })
      )
    ).toBeNull();
  });

  it('maps failed payments with the attempt count', () => {
    expect(
      stripeEventToFunnelEvent(
        ev('invoice.payment_failed', {
          billing_reason: 'subscription_cycle',
          attempt_count: 2,
          metadata: { userId: 'u1' },
        })
      )
    ).toEqual({
      userId: 'u1',
      event: 'invoice_payment_failed',
      properties: { billing_reason: 'subscription_cycle', attempt_count: 2 },
    });
  });

  it('flags a cancellation made during the trial and keeps the reason', () => {
    const during = stripeEventToFunnelEvent(
      ev('customer.subscription.deleted', {
        metadata: { userId: 'u1' },
        trial_end: 2000,
        canceled_at: 1500,
        cancellation_details: { reason: 'cancellation_requested', feedback: 'unused' },
        items: { data: [{ price: { recurring: { interval: 'month' } } }] },
      })
    );
    expect(during).toMatchObject({
      event: 'subscription_canceled',
      properties: {
        reason: 'cancellation_requested',
        feedback: 'unused',
        during_trial: true,
        interval: 'month',
      },
    });

    const after = stripeEventToFunnelEvent(
      ev('customer.subscription.deleted', {
        metadata: { userId: 'u1' },
        trial_end: 1000,
        canceled_at: 5000,
        items: { data: [] },
      })
    );
    expect(after?.properties.during_trial).toBe(false);
  });

  it('ignores unrelated events and never includes an email', () => {
    expect(stripeEventToFunnelEvent(ev('customer.updated', {}))).toBeNull();
    const mapped = stripeEventToFunnelEvent(
      ev('invoice.paid', {
        amount_paid: 1500,
        customer_email: 'person@example.com',
        metadata: { userId: 'u1' },
      })
    );
    expect(JSON.stringify(mapped)).not.toContain('person@example.com');
  });
});
