'use client'

import Script from 'next/script'

/**
 * Crisp live chat bubble. Renders nothing unless NEXT_PUBLIC_CRISP_WEBSITE_ID
 * is set, so local dev and forks are unaffected.
 */
export function CrispWidget() {
  const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID

  if (!websiteId) return null

  return (
    <Script
      id="crisp-sdk"
      strategy="lazyOnload"
      dangerouslySetInnerHTML={{
        __html: `window.$crisp=window.$crisp||[];window.CRISP_WEBSITE_ID=${JSON.stringify(websiteId)};(function(){var d=document,s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`,
      }}
    />
  )
}
