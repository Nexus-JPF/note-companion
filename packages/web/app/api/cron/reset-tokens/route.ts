import { db, UserUsageTable } from '@/drizzle/schema';
import { eq, and, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

async function resetTokenUsage() {
  const monthlyTokenLimit = 5000 * 1000; // 5M tokens
  const monthlyAudioTranscriptionLimit = 300; // 300 minutes per month for paid users

  // Reset tokens and audio transcription minutes for active subscribers with valid plans
  const result = await db
    .update(UserUsageTable)
    .set({
      tokenUsage: 0,
      maxTokenUsage: monthlyTokenLimit,
      audioTranscriptionMinutes: 0,
      maxAudioTranscriptionMinutes: monthlyAudioTranscriptionLimit, // 300 minutes for paid users
    })
    .where(
      and(
        or(
          eq(UserUsageTable.subscriptionStatus, 'active'),
          eq(UserUsageTable.subscriptionStatus, 'succeeded'),
          eq(UserUsageTable.subscriptionStatus, 'paid')
        ),
        or(
          eq(UserUsageTable.paymentStatus, 'paid'),
          eq(UserUsageTable.paymentStatus, 'succeeded')
        ),
        or(
          eq(UserUsageTable.billingCycle, 'monthly'),
          eq(UserUsageTable.billingCycle, 'yearly'),
          eq(UserUsageTable.billingCycle, 'subscription'),
          eq(UserUsageTable.billingCycle, 'default')
        )
      )
    );

  // Also reset audio transcription for free tier users (set to 0)
  const freeTierResult = await db
    .update(UserUsageTable)
    .set({
      audioTranscriptionMinutes: 0,
      maxAudioTranscriptionMinutes: 0, // Free tier gets 0 minutes
    })
    .where(
      and(
        or(
          eq(UserUsageTable.subscriptionStatus, 'inactive'),
          eq(UserUsageTable.paymentStatus, 'unpaid')
        ),
        eq(UserUsageTable.tier, 'free')
      )
    );

  // Get number of affected rows
  const affectedRows = result.rowCount || 0;
  const freeTierAffectedRows = freeTierResult.rowCount || 0;

  // return amount of users reset
  return {
    success: true,
    message: 'Token and audio transcription usage reset successful',
    usersReset: affectedRows,
    freeTierUsersReset: freeTierAffectedRows,
  };
}

export async function GET(request: Request) {
  try {
    // Verify that the request is coming from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const result = await resetTokenUsage();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error resetting token usage:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset token usage' },
      { status: 500 }
    );
  }
}
