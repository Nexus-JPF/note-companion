import { PgDialect } from 'drizzle-orm/pg-core';
import { handleSubscriptionCanceled } from './subscription-canceled';

const mockUpdateSet = jest.fn();

jest.mock('@/drizzle/schema', () => {
  const { pgTable, text, boolean } = jest.requireActual('drizzle-orm/pg-core');
  return {
    UserUsageTable: pgTable('user_usage', {
      userId: text('userId'),
      billingCycle: text('billingCycle'),
      hasCatalystAccess: boolean('hasCatalystAccess'),
    }),
    db: {
      update: jest.fn(() => ({
        set: (s: any) => {
          mockUpdateSet(s);
          return { where: jest.fn().mockResolvedValue(undefined) };
        },
      })),
    },
  };
});

jest.mock('../utils', () => ({
  updateUserSubscriptionData: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/clerk', () => ({
  updateClerkMetadata: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/services/loops', () => ({
  updateLoopsContactBillingCycle: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    customers: { retrieve: jest.fn().mockResolvedValue({ email: 'a@b.com' }) },
  }))
);

const render = (expr: any) => new PgDialect().sqlToQuery(expr);

const canceledEvent = (metadata: Record<string, string>) =>
  ({
    id: 'evt_1',
    type: 'customer.subscription.deleted',
    data: {
      object: {
        id: 'sub_1',
        customer: 'cus_1',
        metadata,
        items: { data: [] },
      },
    },
  }) as any;

describe('handleSubscriptionCanceled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('marks the row cancelled in one UPDATE that clears catalyst access', async () => {
    const result = await handleSubscriptionCanceled(
      canceledEvent({ userId: 'user_1' })
    );
    expect(result.success).toBe(true);
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);

    const set = mockUpdateSet.mock.calls[0][0];
    expect(set.subscriptionStatus).toBe('canceled');
    expect(set.paymentStatus).toBe('canceled');
    expect(render(set.hasCatalystAccess).sql).toBe(
      `CASE WHEN "user_usage"."billingCycle" = 'lifetime' THEN "user_usage"."hasCatalystAccess" ELSE false END`
    );
  });

  it('does not overwrite a lifetime billing cycle with none', async () => {
    await handleSubscriptionCanceled(canceledEvent({ userId: 'user_1' }));
    const { sql, params } = render(mockUpdateSet.mock.calls[0][0].billingCycle);
    expect(sql).toBe(
      `CASE WHEN "user_usage"."billingCycle" = 'lifetime' THEN "user_usage"."billingCycle" ELSE $1 END`
    );
    expect(params).toEqual(['none']);
  });

  it('writes nothing when the subscription has no user id', async () => {
    const result = await handleSubscriptionCanceled(canceledEvent({}));
    expect(result.success).toBe(false);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});
