import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getUserBillingCycleForUser } from '@/lib/account-server';

// Force dynamic rendering to avoid static generation issues with Clerk
export const dynamic = 'force-dynamic';

export default async function MainPage() {
  if (process.env.ENABLE_USER_MANAGEMENT !== 'true') {
    redirect('/dashboard/self-hosted');
  }

  // Check if Clerk is configured before using auth()
  const hasClerkConfig =
    !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    !!process.env.CLERK_SECRET_KEY;

  if (!hasClerkConfig) {
    // If user management is enabled but Clerk isn't configured, redirect to self-hosted
    redirect('/dashboard/self-hosted');
  }

  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (error) {
    // Handle the case where auth() is called but clerkMiddleware isn't detected
    // This can happen for static files or routes that bypass middleware
    if (error instanceof Error && error.message.includes('clerkMiddleware')) {
      console.warn('Clerk middleware not detected for this route, redirecting to self-hosted');
      redirect('/dashboard/self-hosted');
    }
    throw error;
  }

  const billingCycle = await getUserBillingCycleForUser(userId);
  console.log('Billing cycle:', billingCycle);

  // if billing cycle part of legacy plans
  const isSubscription = [
    // legacy cycle
    'monthly',
    'yearly',
    // new up to date cycle
    'subscription',
  ].includes(billingCycle);

  // top-up is not a subscription plan
  const isPayOnce = ['pay-once'].includes(billingCycle);

  // Check if the user has any kind of active subscription
  const hasSubscription = isSubscription || isPayOnce;

  if (hasSubscription) {
    // If user has any kind of subscription, redirect to dashboard
    redirect('/dashboard');
  } else {
    // If user doesn't have a subscription, redirect to the new onboarding page
    redirect('/onboarding');
  }
}
