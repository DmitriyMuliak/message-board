import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { LOGIN_PATH, verifySession } from '@/server/auth-service';

const PUBLIC_PATHS = ['/about', '/contacts', '/faq'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = request.nextUrl.pathname === LOGIN_PATH;
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const session = await verifySession(request.cookies);

  if (session) {
    // An authenticated user shouldn't see the login page.
    return isLoginPage ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }

  // No valid session: /auth/login itself must stay reachable
  if (isLoginPage || isPublicPath) {
    return NextResponse.next();
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set('from', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$|favicon.ico|sitemap.xml|robots.txt).*)'],
};
