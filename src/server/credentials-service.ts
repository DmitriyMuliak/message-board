import 'server-only';

import { db, type DbUser } from '@/server/db';

/**
 * Credential-check layer (§7 of ARCHITECTURE.md), deliberately split from
 * `auth-service.ts`'s stateless JWT layer: this file imports `db.ts` (and
 * transitively `server-only`), which is exactly what `auth-service.ts` must
 * *not* pull in, since `src/proxy.ts` imports that module directly.
 */

/**
 * Single shared demo password for every seeded user — there is no per-user
 * password field on `DbUser` (no real credential storage exists in this
 * mock). Exported so the one login-flow test and any README/demo copy quote
 * this literal instead of a second, driftable hardcoded copy.
 */
export const DEMO_PASSWORD = 'dispatch';

/**
 * Looks up `email` (trimmed, case-insensitive) among the seeded users and
 * checks `password` against the single shared demo password. Returns the
 * matched `DbUser`, or `null` — never throws, and deliberately doesn't
 * distinguish "no such user" from "wrong password" (both collapse to the
 * same `401 INVALID_CREDENTIALS` in the login route handler, so a client
 * can't enumerate valid emails via the error response).
 */
export function verifyCredentials(email: string, password: string): DbUser | null {
  if (password !== DEMO_PASSWORD) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.users.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);
  return user ?? null;
}
