import { Metadata } from 'next';

/** Shared Open Graph fields for marketing pages (set `url` per page). */
export const defaultOpenGraph: NonNullable<Metadata['openGraph']> = {
  type: 'website',
  locale: 'en_US',
  siteName: 'Note Companion',
  images: ['/notecompanion.png'],
};
