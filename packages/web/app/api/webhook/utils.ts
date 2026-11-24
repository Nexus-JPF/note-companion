import { db, UserUsageTable } from "@/drizzle/schema";
import { CustomerData } from "./types";
import { keepLifetimeBillingCycle } from "./lifetime";


export async function updateUserSubscriptionData(
  data: CustomerData
): Promise<void> {
  // Only update billingCycle if it's provided, otherwise keep existing value
  const updateData: any = {
    subscriptionStatus: data.status,
    paymentStatus: data.paymentStatus,
    maxAudioTranscriptionMinutes: 300, // 300 minutes per month for paid subscriptions
    lastPayment: new Date(),
    currentProduct: data.product,
    currentPlan: data.plan,
  };

  // Only set billingCycle if provided (to avoid null constraint violations)
  if (data.billingCycle !== undefined) {
    updateData.billingCycle = keepLifetimeBillingCycle(data.billingCycle);
  }

  await db
    .insert(UserUsageTable)
    .values({
      userId: data.userId,
      subscriptionStatus: data.status,
      paymentStatus: data.paymentStatus,
      billingCycle: data.billingCycle || "none", // Default to 'none' if not provided
      maxAudioTranscriptionMinutes: 300, // 300 minutes per month for paid subscriptions
      lastPayment: new Date(),
      currentProduct: data.product,
      currentPlan: data.plan,
    })
    .onConflictDoUpdate({
      target: [UserUsageTable.userId],
      set: updateData,
    });
}
