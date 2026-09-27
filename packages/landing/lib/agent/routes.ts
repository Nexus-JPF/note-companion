const KNOWN_PAGE_PATHS = new Set([
  '/',
  '/mobile',
  '/privacy',
  '/terms-of-service',
  '/blog',
  '/docs',
  '/developers',
]);

export function isKnownPagePath(pathname: string): boolean {
  if (KNOWN_PAGE_PATHS.has(pathname)) {
    return true;
  }
  if (pathname.startsWith('/blog/') && pathname.length > '/blog/'.length) {
    return true;
  }
  return false;
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
