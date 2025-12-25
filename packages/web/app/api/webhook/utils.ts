import { db, UserUsageTable } from "@/drizzle/schema";
import { CustomerData } from "./types";


export async function updateUserSubscriptionData(
  data: CustomerData
): Promise<void> {
  await db
    .insert(UserUsageTable)
    .values({
      userId: data.userId,
      subscriptionStatus: data.status,
      paymentStatus: data.paymentStatus,
      billingCycle: data.billingCycle,
      maxAudioTranscriptionMinutes: 300, // 300 minutes per month for paid subscriptions
      lastPayment: new Date(),
      currentProduct: data.product,
      currentPlan: data.plan,
    })
    .onConflictDoUpdate({
      target: [UserUsageTable.userId],
      set: {
        subscriptionStatus: data.status,
        paymentStatus: data.paymentStatus,
        billingCycle: data.billingCycle,
        maxAudioTranscriptionMinutes: 300, // 300 minutes per month for paid subscriptions
        lastPayment: new Date(),
        currentProduct: data.product,
        currentPlan: data.plan,
      },
    });
}
