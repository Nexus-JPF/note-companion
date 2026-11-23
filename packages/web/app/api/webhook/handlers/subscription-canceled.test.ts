import { handleSubscriptionCanceled } from './subscription-canceled';

const mockUpdateSet = jest.fn();
let mockExistingRow: { billingCycle: string } | undefined;

jest.mock('@/drizzle/schema', () => ({
  UserUsageTable: {
    userId: 'userId',
    billingCycle: 'billingCycle',
  },
  db: {
    select: jest.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mockExistingRow ? [mockExistingRow] : []),
        }),
      }),
    })),
    update: jest.fn(() => ({
      set: (s: any) => {
        mockUpdateSet(s);
        return { where: jest.fn().mockResolvedValue(undefined) };
      },
    })),
  },
}));

jest.mock('drizzle-orm', () => ({ eq: jest.fn() }));

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
    mockExistingRow = { billingCycle: 'monthly' };
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('clears catalyst access for a cancelled monthly subscriber', async () => {
    const result = await handleSubscriptionCanceled(
      canceledEvent({ userId: 'user_1' })
    );
    expect(result.success).toBe(true);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionStatus: 'canceled',
        paymentStatus: 'canceled',
        billingCycle: 'none',
        hasCatalystAccess: false,
      })
    );
  });

  it('clears catalyst access for a cancelled yearly subscriber', async () => {
    mockExistingRow = { billingCycle: 'yearly' };
    await handleSubscriptionCanceled(canceledEvent({ userId: 'user_1' }));
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ hasCatalystAccess: false })
    );
  });

  it('keeps catalyst access for a lifetime owner who cancels an old subscription', async () => {
    mockExistingRow = { billingCycle: 'lifetime' };
    const result = await handleSubscriptionCanceled(
      canceledEvent({ userId: 'user_1' })
    );
    expect(result.success).toBe(true);
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet.mock.calls[0][0]).not.toHaveProperty(
      'hasCatalystAccess'
    );
  });

  it('still clears access when the user has no usage row yet', async () => {
    mockExistingRow = undefined;
    await handleSubscriptionCanceled(canceledEvent({ userId: 'user_1' }));
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ hasCatalystAccess: false })
    );
  });

  it('writes nothing when the subscription has no user id', async () => {
    const result = await handleSubscriptionCanceled(canceledEvent({}));
    expect(result.success).toBe(false);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});
