"use client";

import * as React from "react";
import { getBillingPortalUrl } from "@/app/dashboard/billing/actions";

const FALLBACK_URL = process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL;

/**
 * Link that opens the Stripe billing portal for the signed-in user.
 * Renders as an anchor to the generic portal URL until clicked, so it still
 * works without JS or if the session lookup fails.
 */
export function ManageSubscriptionLink({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, setPending] = React.useState(false);

  const onClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const url = await getBillingPortalUrl().catch(() => null);
    window.location.href = url ?? FALLBACK_URL ?? "/dashboard/settings";
  };

  return (
    <a
      href={FALLBACK_URL}
      onClick={onClick}
      className={pending ? `${className ?? ""} cursor-wait opacity-70` : className}
      aria-busy={pending}
    >
      {children}
    </a>
  );
}
