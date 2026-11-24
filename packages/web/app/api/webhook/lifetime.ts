import { sql } from "drizzle-orm";
import { UserUsageTable } from "@/drizzle/schema";

/**
 * A lifetime licence is a one-time purchase that outlives any subscription,
 * and `billingCycle = 'lifetime'` is the only marker the app has for it.
 * Subscription webhooks (updated, deleted, invoice.paid) must not overwrite
 * it, so every billingCycle write on an existing row goes through this CASE.
 */
export function keepLifetimeBillingCycle(value: string) {
  return sql`CASE WHEN ${UserUsageTable.billingCycle} = 'lifetime' THEN ${UserUsageTable.billingCycle} ELSE ${value} END`;
}

/** Cancelling a subscription clears Catalyst, except for lifetime owners. */
export function clearCatalystUnlessLifetime() {
  return sql`CASE WHEN ${UserUsageTable.billingCycle} = 'lifetime' THEN ${UserUsageTable.hasCatalystAccess} ELSE false END`;
}
