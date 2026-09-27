import { NextResponse } from 'next/server';

export function markdownResponse(body: string, status = 200): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
    },
  });
}

/** Canonical public marketing origin (apex, no trailing slash). */
export function getSiteBaseUrl(): string {
  let base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://notecompanion.ai');

  base = base.replace(/\/$/, '');
  base = base.replace(/^https:\/\/www\./i, 'https://');
  return base;
}
