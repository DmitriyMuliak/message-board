'use client';

import type { ReactNode } from 'react';

import { AuthorPortProvider } from '../api/author.port';
import { followAuthorAction } from '../api/follow-author.action';
import { AuthorCard } from './AuthorCard';

/**
 * The feature's own default wiring — the production mirror of the testkit's
 * `wrap()`.
 *
 * THIS FILE, NOT THE APP ROOT. A single `<AllPorts>` at the app root is a
 * service locator, not dependency injection: one file that imports every
 * feature, every route paying for all fifty ports when it uses two, and one
 * shared file every feature has to edit. Here, a page that uses two widgets
 * mounts two.
 *
 * Kept apart from `author.port.tsx` so the port module never imports the
 * action.
 */
export function ConnectedAuthorPort({ children }: { children: ReactNode }) {
  return <AuthorPortProvider value={{ follow: followAuthorAction }}>{children}</AuthorPortProvider>;
}

/** What a route renders. It mounts nothing itself. */
export function ConnectedAuthorCard(props: React.ComponentProps<typeof AuthorCard>) {
  return (
    <ConnectedAuthorPort>
      <AuthorCard {...props} />
    </ConnectedAuthorPort>
  );
}
