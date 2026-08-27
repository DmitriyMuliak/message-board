'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { FollowAuthorState } from '../model/types';

/**
 * What AuthorCard needs from the outside world, as an interface IT OWNS.
 *
 * The widget depends on this, not on a server-action module. That is what lets
 * a test swap the implementation by rendering a different provider — no
 * `vi.mock`, so no hoisting, no import-order fragility, and kits that compose
 * as ordinary objects.
 *
 * This file must import NOTHING but `react` and a type. The moment it imports
 * the action, every kit that imports the port pulls the server graph into
 * jsdom — which is exactly what the port exists to prevent.
 */
export interface AuthorPort {
  follow(input: { authorId: string }): Promise<FollowAuthorState>;
}

const AuthorPortContext = createContext<AuthorPort | null>(null);

export function AuthorPortProvider({
  value,
  children,
}: {
  value: AuthorPort;
  children: ReactNode;
}) {
  return <AuthorPortContext.Provider value={value}>{children}</AuthorPortContext.Provider>;
}

export function useAuthorPort(): AuthorPort {
  const port = useContext(AuthorPortContext);
  if (!port) {
    // Loud on purpose. A missing provider is a wiring bug, and the alternative
    // — a silently undefined dependency — surfaces much later and much worse.
    throw new Error('useAuthorPort must be called within an AuthorPortProvider');
  }
  return port;
}
