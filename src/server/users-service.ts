import 'server-only';

import { db } from '@/server/db';

export interface PublicUser {
  id: string;
  name: string;
  handle: string;
}

/** Strips `email` — internal-only (`credentials-service.ts`'s login lookup),
 * never sent to the client. */
export function listUsers(): PublicUser[] {
  return db.users.map((user) => ({ id: user.id, name: user.name, handle: user.handle }));
}

export function getUserById(id: string): PublicUser | null {
  const user = db.users.find((candidate) => candidate.id === id);
  return user ? { id: user.id, name: user.name, handle: user.handle } : null;
}
