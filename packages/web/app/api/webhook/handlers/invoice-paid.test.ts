import { handleInvoicePaid } from './invoice-paid';

const mockInsertValues = jest.fn();
const mockConflictSet = jest.fn();
const mockUpdateSet = jest.fn();

jest.mock('@/drizzle/schema', () => ({
  UserUsageTable: {
    userId: 'userId',
    maxTokenUsage: 'maxTokenUsage',
    tokenUsage: 'tokenUsage',
  },
  db: {
    insert: jest.fn(() => ({
      values: (v: any) => {
        mockInsertValues(v);
        return {
          onConflictDoUpdate: (c: any) => {
            mockConflictSet(c.set);
            return Promise.resolve();
          },
        };
      },
    })),
    update: jest.fn(() => ({
      set: (s: any) => {
        mockUpdateSet(s);
        return { where: jest.fn().mockResolvedValue(undefined) };
      },
    })),
  },
}));

jest.mock('@/lib/services/loops', () => ({
  trackLoopsEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    subscriptions: { retrieve: jest.fn() },
  }))
);

const invoiceEvent = (metadata: Record<string, string>) =>
  ({
    id: 'evt_1',
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_1',
        status: 'paid',
        customer_email: 'a@b.com',
        amount_paid: 1500,
        subscription: null,
        metadata,
        lines: { data: [{ price: { metadata: {} } }] },
      },
    },
  }) as any;

describe('handleInvoicePaid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('grants catalyst access when a new user record is created', async () => {
    const result = await handleInvoicePaid(
      invoiceEvent({ userId: 'user_1', type: 'monthly' })
    );
    expect(result.success).toBe(true);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_1', hasCatalystAccess: true })
    );
  });

  it('grants catalyst access when an existing user record is updated', async () => {
    await handleInvoicePaid(invoiceEvent({ userId: 'user_1', type: 'yearly' }));
    expect(mockConflictSet).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'paid', hasCatalystAccess: true })
    );
  });

  it('skips invoices without a user id and writes nothing', async () => {
    const result = await handleInvoicePaid(invoiceEvent({}));
    expect(result.success).toBe(true);
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});
