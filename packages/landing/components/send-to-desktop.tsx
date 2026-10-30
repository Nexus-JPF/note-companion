'use client';

import { useEffect, useState } from 'react';
import { Mail, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CANONICAL_SITE_URL } from '@/lib/site-url';

// One link for every way of sharing, always on the canonical host so previews,
// dev servers and the apex domain all hand off the same URL.
const HANDOFF_URL = `${CANONICAL_SITE_URL}/obsidian?utm_source=mobile_handoff&utm_medium=share&utm_campaign=obsidian_page`;
const TITLE = 'Note Companion for Obsidian';
const TEXT = 'Install Note Companion in Obsidian on your computer:';

/**
 * Mobile visitors can't install an Obsidian plugin from their phone, so give
 * them a one-tap way to send this page to the computer they will install on.
 * Uses the phone's share sheet when available, otherwise opens their email app.
 * Nothing is sent to our servers and no email address is collected.
 */
export function SendToDesktop() {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  if (canShare) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        data-attr="send-to-desktop-share"
        onClick={() => {
          // The share sheet can be dismissed; that rejects and is not an error
          navigator.share({ title: TITLE, text: TEXT, url: HANDOFF_URL }).catch(() => {});
        }}
      >
        <Share2 className="h-4 w-4" aria-hidden />
        Send this page to my computer
      </Button>
    );
  }

  const mailto = `mailto:?subject=${encodeURIComponent(TITLE)}&body=${encodeURIComponent(
    `${TEXT}\n\n${HANDOFF_URL}`
  )}`;

  return (
    <Button asChild variant="outline" size="sm" className="gap-2" data-attr="send-to-desktop-email">
      <a href={mailto}>
        <Mail className="h-4 w-4" aria-hidden />
        Email this page to myself
      </a>
    </Button>
  );
}
