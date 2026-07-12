import { jwtVerify, SignJWT } from 'jose';
import { cache } from 'react';
import { cookies } from 'next/headers';

/**
 * Stateless session (JWT) layer. Deliberately has
 * **no** dependency on `db.ts` / `server-only`: this module is imported both
 * by route handlers (full server bundle) and by `src/proxy.ts` (Next 16's
 * middleware replacement, a separate, more constrained bundle — see
 * proxy.ts's own comments). Credential verification (which *does* need
 * `db.ts`) lives in the sibling `credentials-service.ts` on purpose, so
 * importing "check a password" never drags "read the in-memory database"
 * into the proxy bundle. Do not add `import 'server-only'` here.
 */

/** Name of the cookie that carries the signed session JWT. */
export const SESSION_COOKIE_NAME = 'session';

/**
 * The one place the login route is spelled out. Shared by `proxy.ts` (the
 * optimistic redirect) and `requireSession()` (the defence-in-depth one), which
 * previously each hard-coded it — and had already drifted apart: the fallback
 * pointed at a `/login` that does not exist, so it dead-ended in a 404 exactly
 * when the proxy failed to run. Kept a plain string so the constrained proxy
 * bundle can import it.
 */
export const LOGIN_PATH = '/auth/login';

/**
 * `Max-Age` for the session cookie, in seconds (7 days). Shared by every
 * route handler that sets the cookie (`cookies().set`) and re-derived below
 * for the JWT's own `exp` claim, so the cookie's lifetime and the token's
 * validity never drift apart.
 */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** Same duration as {@link SESSION_COOKIE_MAX_AGE_SECONDS}, in `jose`'s
 * relative-time-span string format (see `setExpirationTime`'s doc comment
 * in `jose`'s types: a `number` is an *absolute* unix timestamp, not a
 * duration — a string like `'7d'` is what gets resolved relative to "now"). */
const SESSION_TTL = '7d';

export interface Session {
  userId: string;
}

/**
 * The minimal structural shape both Next 16's RSC/Route-Handler `await
 * cookies()` (from `next/headers`) and a `NextRequest`'s own `.cookies`
 * (header-based, no request-store dependency) satisfy — the only method
 * {@link verifySession} needs. Kept structural (no Next type imported) so
 * this module stays framework-light and either call site just works.
 */
export interface ReadonlyCookieStore {
  get(name: string): { value: string } | undefined;
}

const textEncoder = new TextEncoder();

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set. See .env.example.');
  }
  return textEncoder.encode(secret);
}

/**
 * Signs a new session JWT for `userId` (payload `{ sub: userId }`, HS256 —
 * §7). Unlike {@link verifySessionToken}, this *does* throw if
 * `SESSION_SECRET` is missing — it only ever runs on the login path, where a
 * loud server error is the right failure mode for a misconfigured
 * deployment (fail fast on a config bug, rather than silently issuing an
 * unverifiable session).
 */
export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecretKey());
}

/**
 * Verifies a raw session JWT. **Never throws** — a malformed, expired, or
 * tampered token, an unexpected payload shape, or even a missing
 * `SESSION_SECRET`, all resolve to `null` so every caller (route handlers,
 * `proxy.ts`, the Stage-3 SSR feed page) can treat "invalid" and "absent"
 * identically and fail closed (redirect / `401`) instead of crashing.
 */
export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return null;
    }
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

/**
 * The **one** session-verification entry point (§9), called both by every
 * route handler's auth check and by the Stage-3 SSR feed page. Takes an
 * already-resolved cookie store so the call reads identically in both
 * contexts, e.g. `await verifySession(await cookies())` from an RSC
 * `page.tsx`, or `await verifySession(request.cookies)` from a route
 * handler's `NextRequest`.
 */
export async function verifySession(cookieStore: ReadonlyCookieStore): Promise<Session | null> {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

/**
 * A React `cache()`-wrapped helper to get the current session.
 * Ensures that JWT decoding happens exactly once per request, even if called
 * multiple times across different layouts and pages.
 */
export const getSession = cache(async () => {
  return verifySession(await cookies());
});
