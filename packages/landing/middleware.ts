import { type NextRequest, NextResponse } from 'next/server';
import { prefersMarkdown } from '@/lib/agent/accept';
import {
  buildHomeMarkdown,
  buildNotFoundMarkdown,
} from '@/lib/agent/markdown-content';
import { markdownResponse } from '@/lib/agent/markdown-response';
import { isKnownPagePath, shouldSkipMiddleware } from '@/lib/agent/routes';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const wantsMarkdown = prefersMarkdown(request.headers.get('accept'));

  if (wantsMarkdown) {
    if (pathname === '/') {
      return markdownResponse(buildHomeMarkdown());
    }

    if (!isKnownPagePath(pathname)) {
      return markdownResponse(buildNotFoundMarkdown(pathname), 404);
    }
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
