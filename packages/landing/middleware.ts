import { type NextRequest, NextResponse } from 'next/server';
import { resolveAgentMarkdownRoute } from '@/lib/agent/markdown-routing';
import { markdownResponse } from '@/lib/agent/markdown-response';
import { shouldSkipMiddleware } from '@/lib/agent/routes';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const route = resolveAgentMarkdownRoute(
    pathname,
    request.headers.get('accept')
  );

  if (route.action === 'respond') {
    return markdownResponse(route.body, route.status);
  }

  const response = NextResponse.next();
  if (pathname === '/') {
    response.headers.set('Vary', 'Accept');
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
