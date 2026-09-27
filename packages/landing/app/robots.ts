import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Use environment variable if available, otherwise default to notecompanion.ai
  let baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://notecompanion.ai');

  // Ensure URL doesn't have trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

