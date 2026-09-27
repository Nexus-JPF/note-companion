import blogSlugs from './blog-slugs.generated.json';

const KNOWN_PAGE_PATHS = new Set([
  '/',
  '/mobile',
  '/privacy',
  '/terms-of-service',
  '/blog',
  '/docs',
  '/developers',
  '/demo',
]);

const BLOG_SLUGS = new Set(blogSlugs as string[]);

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function isKnownBlogPostPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  const prefix = '/blog/';
  if (!normalized.startsWith(prefix)) {
    return false;
  }
  const slug = normalized.slice(prefix.length);
  if (!slug || slug.includes('/')) {
    return false;
  }
  return BLOG_SLUGS.has(slug);
}

export function isKnownPagePath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (KNOWN_PAGE_PATHS.has(normalized)) {
    return true;
  }
  return isKnownBlogPostPath(normalized);
}

export function shouldSkipMiddleware(pathname: string): boolean {
  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/llms.txt' ||
    pathname === '/openapi.json'
  ) {
    return true;
  }

  return /\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|css|js|txt|xml|json)$/i.test(
    pathname
  );
}
