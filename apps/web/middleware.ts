import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Must match AUTH_COOKIE_NAME in apps/api (auth.service.ts).
const AUTH_COOKIE_NAME = 'access_token';

/**
 * Lightweight presence check only — the cookie's validity (signature, expiry,
 * role) is always verified by the API on /auth/me and every guarded endpoint.
 */
export function middleware(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(AUTH_COOKIE_NAME);
  const isLoginRoute = request.nextUrl.pathname === '/login';

  if (isLoginRoute && hasSessionCookie) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!isLoginRoute && !hasSessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next.js internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
