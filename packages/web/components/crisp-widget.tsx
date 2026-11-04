'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { useUser } from '@clerk/nextjs';

declare global {
  interface Window {
    $crisp?: unknown[];
  }
}

/**
 * Crisp live chat bubble for the signed-in dashboard. Renders nothing unless
 * NEXT_PUBLIC_CRISP_WEBSITE_ID is set. Signed-in users' name and email are
 * passed to Crisp so support conversations are tied to their account.
 */
export function CrispWidget() {
  const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!websiteId || !isLoaded || !user) return;
    // Crisp replays queued commands once its script has loaded.
    window.$crisp = window.$crisp || [];
    const email = user.primaryEmailAddress?.emailAddress;
    if (email) window.$crisp.push(['set', 'user:email', [email]]);
    if (user.fullName) window.$crisp.push(['set', 'user:nickname', [user.fullName]]);
  }, [websiteId, isLoaded, user]);

  if (!websiteId) return null;

  return (
    <Script
      id="crisp-sdk"
      strategy="lazyOnload"
      dangerouslySetInnerHTML={{
        __html: `window.$crisp=window.$crisp||[];window.CRISP_WEBSITE_ID=${JSON.stringify(websiteId)};(function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`,
      }}
    />
  );
}
