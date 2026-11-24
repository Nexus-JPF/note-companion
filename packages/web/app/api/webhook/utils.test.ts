import { PgDialect } from 'drizzle-orm/pg-core';
import { updateUserSubscriptionData } from './utils';

const mockInsertValues = jest.fn();
const mockConflictSet = jest.fn();

jest.mock('@/drizzle/schema', () => {
  const { pgTable, text, boolean } = jest.requireActual('drizzle-orm/pg-core');
  return {
    UserUsageTable: pgTable('user_usage', {
      userId: text('userId'),
      billingCycle: text('billingCycle'),
      hasCatalystAccess: boolean('hasCatalystAccess'),
    }),
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
    },
  };
});

const customer = (billingCycle: any) => ({
  userId: 'user_1',
  customerId: 'cus_1',
  status: 'active',
  paymentStatus: 'active',
  billingCycle,
  product: 'p',
  plan: 'x',
  lastPayment: new Date(),
});

describe('updateUserSubscriptionData', () => {
  beforeEach(() => jest.clearAllMocks());

  it('never overwrites an existing lifetime billing cycle (subscription.updated)', async () => {
    await updateUserSubscriptionData(customer('monthly'));
    const { sql, params } = new PgDialect().sqlToQuery(
      mockConflictSet.mock.calls[0][0].billingCycle
    );
    expect(sql).toBe(
      `CASE WHEN "user_usage"."billingCycle" = 'lifetime' THEN "user_usage"."billingCycle" ELSE $1 END`
    );
    expect(params).toEqual(['monthly']);
  });

  it('inserts the plain billing cycle for a brand new row', async () => {
    await updateUserSubscriptionData(customer('yearly'));
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ billingCycle: 'yearly' })
    );
  });

  it('leaves billingCycle out of the update when none is given', async () => {
    await updateUserSubscriptionData(customer(undefined));
    expect(mockConflictSet.mock.calls[0][0]).not.toHaveProperty('billingCycle');
  });
});
