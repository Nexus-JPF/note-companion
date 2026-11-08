/**
 * Canonical public marketing origin (www, no trailing slash).
 * Vercel redirects the apex domain to www, so canonicals, sitemap and
 * Open Graph URLs must all use www to agree with the redirect.
 */
export const CANONICAL_SITE_URL = 'https://www.notecompanion.ai';

export function getSiteBaseUrl(): string {
  // Production always uses the canonical host, so a missing or wrong
  // NEXT_PUBLIC_SITE_URL can't leak a *.vercel.app URL into canonicals.
  if (process.env.VERCEL_ENV === 'production') {
    return CANONICAL_SITE_URL;
  }

  let base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : CANONICAL_SITE_URL);

  base = base.replace(/\/$/, '');
  // Normalize the apex production host to www (the host Vercel serves).
  base = base.replace(/^https:\/\/notecompanion\.ai$/i, CANONICAL_SITE_URL);
  return base;
}

export const HOME_OG_IMAGE_PATH = '/notecompanion.png';
