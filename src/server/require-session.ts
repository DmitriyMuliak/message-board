import 'server-only';

import { redirect } from 'next/navigation';

import { getSession, LOGIN_PATH, type Session } from './auth-service';

/**
 * Returns the current session, or redirects to the login page.
 *
 * This is the defence-in-depth half of auth. `proxy.ts` already redirects
 * unauthenticated traffic, but that is an *optimistic* check and cannot be the
 * only one:
 *
 * - the proxy's `matcher` excludes `/api/**` entirely (route handlers rely on
 *   `withApiRoute`'s own `verifySession` instead);
 * - it lets unauthenticated requests through on `/auth/login` and the public
 *   paths — and a Server Action POSTs to whatever route the client is on, so an
 *   action invoked from the login page never meets the proxy's redirect. Actions
 *   verify the session themselves for that reason;
 * - middleware sits outside the data layer, so any bypass (misconfigured
 *   matcher, a framework-level bypass) removes auth for the whole app at once.
 *
 * Deliberately not placed in `auth-service.ts`: that module is imported by
 * `proxy.ts`, whose bundle must not pull in `next/navigation`.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();

  if (!session) {
    redirect(LOGIN_PATH);
  }

  return session;
}
