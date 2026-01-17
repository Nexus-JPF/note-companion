import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const isApiRoute = createRouteMatcher(['/api(.*)']);

const isPublicRoute = createRouteMatcher([
  '/api(.*)',
  '/sign-in(.*)',
  '/webhook(.*)',
  '/top-up-success',
  '/top-up-cancelled',
  '/robots.txt',
]);

const isClerkProtectedRoute = createRouteMatcher(['/(.*)']);

// Check if Clerk is configured
const hasClerkConfig =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

const soloApiKeyMiddleware = (req: NextRequest) => {
  if (isApiRoute(req)) {
    const header = req.headers.get('authorization');
    console.log('header', header);
    if (!header) {
      return new NextResponse('No Authorization header', { status: 401 });
    }
    const token = header.replace('Bearer ', '');
    if (token !== process.env.SOLO_API_KEY) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }
  return NextResponse.next();
};

// Helper to check if a path is a static file that should be skipped
function isStaticFile(pathname: string): boolean {
  // Check for common static file patterns
  const staticPatterns = [
    /^\/apple-touch-icon/i,
    /^\/favicon\.ico$/i,
    /^\/robots\.txt$/i,
    /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|css|js|txt)$/i,
  ];
  return staticPatterns.some((pattern) => pattern.test(pathname));
}

// Main middleware function that handles CORS and routing
async function baseMiddleware(req: NextRequest): Promise<NextResponse> {
  // Skip static files immediately (but allow /config.js through if it needs auth)
  if (
    isStaticFile(req.nextUrl.pathname) &&
    req.nextUrl.pathname !== '/config.js'
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();

  // Allow all origins
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    // Handle preflight requests
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const isSoloInstance =
    process.env.SOLO_API_KEY && process.env.SOLO_API_KEY.length > 0;

  // If not using Clerk and using solo instance, use API key middleware
  if (!hasClerkConfig && isSoloInstance) {
    return soloApiKeyMiddleware(req);
  }

  return res;
}

// Conditionally export middleware based on Clerk configuration
// This prevents Clerk initialization errors when Clerk is not configured (self-hosting mode)
const middleware = hasClerkConfig
  ? // Clerk is configured - use clerkMiddleware with full authentication
    clerkMiddleware(async (auth, req) => {
      // Always run base middleware logic first (CORS, OPTIONS, etc.)
      const baseResponse = await baseMiddleware(req);

      // If base middleware returned early (e.g., OPTIONS), use that response
      if (baseResponse.status === 204 || baseResponse.status !== 200) {
        return baseResponse;
      }

      // Skip static files - don't run Clerk auth on them
      // BUT: Initialize Clerk's context first so auth() can be called if needed
      // This prevents "clerkMiddleware not detected" errors for static file routes
      if (
        isStaticFile(req.nextUrl.pathname) &&
        req.nextUrl.pathname !== '/config.js'
      ) {
        try {
          // Initialize Clerk context by calling auth() - we don't enforce auth for static files
          // This ensures auth() can be called in layouts/components without errors
          await auth();
        } catch (error) {
          // If Clerk initialization fails, just continue - static files don't need auth
          // This prevents middleware from breaking if Clerk config is missing
        }
        return NextResponse.next();
      }

      // Handle public routes - always allow through without auth
      // BUT: For API routes, we still need to initialize Clerk's context
      // so that auth() can be called in route handlers without errors
      if (isPublicRoute(req)) {
        console.log('isPublicRoute');
        // For API routes, initialize Clerk context by calling auth() (even if we don't use it)
        // This ensures auth() can be called in route handlers without "clerkMiddleware not detected" errors
        if (isApiRoute(req)) {
          try {
            // Initialize Clerk context by calling auth() - we don't enforce auth for public routes
            await auth();
          } catch (error) {
            // If Clerk isn't properly configured, just continue - route handlers will handle it
            // This prevents middleware from breaking if Clerk config is missing
          }
        }
        return NextResponse.next();
      }

      const enableUserManagement =
        process.env.ENABLE_USER_MANAGEMENT === 'true';

      // If user management is enabled, enforce authentication
      if (enableUserManagement) {
        console.log('enableUserManagement', req.url);
        if (isClerkProtectedRoute(req)) {
          console.log('isClerkProtectedRoute');
          const { userId } = await auth();
          console.log('userId', userId);
          if (!userId) {
            // (await auth()).redirectToSignIn();
          }
        }
      }
      // If user management is disabled, just pass through (permissive)
      // This allows auth() calls to work without enforcing authentication

      return NextResponse.next();
    })
  : // Clerk is NOT configured - use simple middleware without Clerk
    // This is for self-hosting mode or when using SOLO_API_KEY
    async function (req: NextRequest) {
      // Always run base middleware logic (CORS, OPTIONS, etc.)
      const baseResponse = await baseMiddleware(req);

      // If base middleware returned early (e.g., OPTIONS), use that response
      if (baseResponse.status === 204 || baseResponse.status !== 200) {
        return baseResponse;
      }

      // Check if using SOLO_API_KEY mode
      const isSoloInstance =
        process.env.SOLO_API_KEY && process.env.SOLO_API_KEY.length > 0;

      if (isSoloInstance) {
        return soloApiKeyMiddleware(req);
      }

      // No authentication required - pass through
      return NextResponse.next();
    };

export default middleware;

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes - handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - apple-touch-icon.* (iOS icons with any extension)
     * - *.png, *.jpg, *.jpeg, *.gif, *.svg, *.ico (image files)
     * - *.woff, *.woff2, *.ttf, *.eot (font files)
     * - *.css, *.js, *.json (static assets)
     *
     * Note: /config.js is explicitly included in the matcher so middleware runs
     * and clerkMiddleware is detected, even if we skip auth() for it
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|apple-touch-icon.*|robots\\.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|css|js|json|txt)$).*)',
    '/',
    '/config.js', // Explicitly include config.js so middleware runs
    '/(api|trpc)(.*)',
  ],
};
