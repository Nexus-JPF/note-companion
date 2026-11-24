import { PgDialect } from 'drizzle-orm/pg-core';
import {
  keepLifetimeBillingCycle,
  clearCatalystUnlessLifetime,
} from './lifetime';

jest.mock('@/drizzle/schema', () => {
  const { pgTable, text, boolean } = jest.requireActual('drizzle-orm/pg-core');
  return {
    UserUsageTable: pgTable('user_usage', {
      userId: text('userId'),
      billingCycle: text('billingCycle'),
      hasCatalystAccess: boolean('hasCatalystAccess'),
    }),
  };
});

const render = (expr: any) => new PgDialect().sqlToQuery(expr);

describe('lifetime guards', () => {
  it('keeps billingCycle when it is lifetime, otherwise writes the new value', () => {
    const { sql, params } = render(keepLifetimeBillingCycle('monthly'));
    expect(sql).toBe(
      `CASE WHEN "user_usage"."billingCycle" = 'lifetime' THEN "user_usage"."billingCycle" ELSE $1 END`
    );
    expect(params).toEqual(['monthly']);
  });

  it('keeps hasCatalystAccess for lifetime owners and clears it for everyone else', () => {
    const { sql, params } = render(clearCatalystUnlessLifetime());
    expect(sql).toBe(
      `CASE WHEN "user_usage"."billingCycle" = 'lifetime' THEN "user_usage"."hasCatalystAccess" ELSE false END`
    );
    expect(params).toEqual([]);
  });
});
