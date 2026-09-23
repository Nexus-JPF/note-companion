'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { submitProWaitlist } from '../actions';

// PostHog is initialised lazily in posthog-root.tsx and this component sits
// outside its provider, so capture through the shared singleton.
const capture = (event: string, properties?: Record<string, unknown>) => {
  void import('posthog-js').then(({ default: posthog }) =>
    posthog.capture(event, properties)
  );
};

export function PricingCards() {
  const [isYearly, setIsYearly] = useState(false);
  const [showProForm, setShowProForm] = useState(false);
  const [proEmail, setProEmail] = useState('');
  const [proStatus, setProStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [proMessage, setProMessage] = useState('');
  const billing = isYearly ? 'yearly' : 'monthly';
  // Locked in when the waitlist form opens so a mid-form toggle can't make
  // the click and join events (or the stored billing) disagree.
  const [proBilling, setProBilling] = useState<'monthly' | 'yearly'>(billing);

  const handleProSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProStatus('loading');
    const result = await submitProWaitlist(proEmail, proBilling);
    setProStatus(result.success ? 'success' : 'error');
    setProMessage(result.message ?? '');
    if (result.success) {
      capture('pro_waitlist_joined', { billing: proBilling });
      setProEmail('');
    }
  };

  const plans = {
    selfHosted: {
      name: 'Self-hosted',
      price: 'Free',
      features: [
        'Ultimate privacy',
        'Use your own AI models',
        'Community support',
        'Source code access',
      ],
      buttonText: 'See Github',
      buttonVariant: 'outline' as const,
    },
    subscription: {
      name: 'Subscription',
      price: isYearly ? '$119' : '$15',
      period: isYearly ? '/year' : '/month',
      features: [
        'Seamless no-sweat setup',
        '~1000 notes per month (5 million tokens)',
        '300 min audio transcription per month',
        'Support',
        '30 days money-back guarantee',
      ],
      buttonText: 'Start Free Trial',
      buttonVariant: 'default' as const,
      highlight: true,
      trial: '7-day free trial',
      discount: isYearly ? 'Save 33% with yearly billing' : undefined,
    },
    pro: {
      name: 'Pro',
      price: isYearly ? '$239' : '$30',
      period: isYearly ? '/year' : '/month',
      features: [
        'Everything in Subscription',
        'Whole-vault indexing & semantic search',
        'Premium AI models for chat and document extraction',
        'Priority processing',
        'Early access to new features',
      ],
    },
  };

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <div className="flex items-center justify-center gap-3 mb-8">
        <span
          className={`text-sm ${
            !isYearly ? 'text-primary font-medium' : 'text-muted-foreground'
          }`}
        >
          Monthly
        </span>
        <Switch
          checked={isYearly}
          onCheckedChange={setIsYearly}
          className="data-[state=checked]:bg-primary data-[state=unchecked]:border-border data-[state=unchecked]:bg-muted"
        />
        <span
          className={`text-sm ${
            isYearly ? 'text-primary font-medium' : 'text-muted-foreground'
          }`}
        >
          Yearly
        </span>
      </div>
      <div className="mx-auto grid w-full max-w-4xl grid-cols-1 md:grid-cols-2 gap-6 px-4">
        {/* Self-Hosted */}
        {/* <div className="relative group h-full">
        <div className="absolute -inset-0.5 border border-2 border-black-500 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 group-hover:from-primary/40 group-hover:via-primary/25 group-hover:to-primary/40 transition-all duration-300" />
        <div className="relative h-full rounded-2xl bg-background/100 backdrop-blur-sm p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-semibold mb-4">Self-Hosted</h3>
              <div className="h-[88px] flex flex-col justify-end mb-8">
                <span className="text-4xl font-bold">Free</span>
              </div>
              <div className="space-y-3 mb-8">
                {plans.selfHosted.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            <Link href="https://github.com/Nexus-JPF/file-organizer-2000" passHref>
              <Button variant="outline" className="w-full">
                See Github
              </Button>
            </Link>
          </div>
        </div> */}

        {/* Subscription - Most Popular */}
        <div className="group relative h-full w-full">
          <div className="absolute -inset-0.5 rounded-2xl border-2 border-border bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 transition-all duration-300 group-hover:from-primary/40 group-hover:via-primary/25 group-hover:to-primary/40" />
          <div className="relative h-full rounded-2xl bg-background/100 backdrop-blur-sm p-6 flex flex-col justify-between">
            <div>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge
                  variant="default"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                >
                  Most Popular
                </Badge>
              </div>
              <h3 className="text-2xl font-semibold mb-4">Subscription</h3>

              {/* Price section matching other cards */}
              <div className="h-[88px] flex flex-col justify-end mb-8">
                <div>
                  <span className="text-4xl font-bold">
                    {isYearly ? '$119' : '$15'}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    {isYearly ? '/year' : '/month'}
                  </span>
                </div>
                {isYearly && (
                  <p className="text-sm text-primary mt-1">
                    Save 33% with yearly billing
                  </p>
                )}
              </div>

              <div className="space-y-3 mb-8">
                {plans.subscription.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            <Link href="https://accounts.notecompanion.ai/sign-up" passHref>
              <Button className="w-full">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        {/* Pro - coming soon, waitlist only */}
        <div className="relative h-full w-full">
          <div className="absolute -inset-0.5 rounded-2xl border-2 border-border" />
          <div className="relative h-full rounded-2xl bg-background/100 backdrop-blur-sm p-6 flex flex-col justify-between">
            <div>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge variant="secondary" className="shadow-sm">
                  Coming soon
                </Badge>
              </div>
              <h3 className="text-2xl font-semibold mb-4">{plans.pro.name}</h3>

              <div className="h-[88px] flex flex-col justify-end mb-8">
                <div>
                  <span className="text-4xl font-bold">{plans.pro.price}</span>
                  <span className="text-muted-foreground ml-1">
                    {plans.pro.period}
                  </span>
                </div>
                {isYearly && (
                  <p className="text-sm text-primary mt-1">
                    Save 33% with yearly billing
                  </p>
                )}
              </div>

              <div className="space-y-3 mb-8">
                {plans.pro.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {proStatus === 'success' ? (
              <p className="text-sm text-center text-primary">{proMessage}</p>
            ) : showProForm ? (
              <form
                onSubmit={(e) => {
                  void handleProSubmit(e);
                }}
                className="flex flex-col gap-2"
              >
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={proEmail}
                    onChange={(e) => setProEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <Button type="submit" disabled={proStatus === 'loading'}>
                    {proStatus === 'loading' ? 'Joining...' : 'Notify me'}
                  </Button>
                </div>
                {proStatus === 'error' && (
                  <p className="text-sm text-destructive">{proMessage}</p>
                )}
              </form>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowProForm(true);
                  setProBilling(billing);
                  capture('pro_waitlist_clicked', { billing });
                }}
              >
                Join the Pro waitlist
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
