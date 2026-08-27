import { vi } from 'vitest';
import type { ReactNode } from 'react';
import type { SetupServer } from 'msw/node';

import { customRender } from '@/test-utils/customRender';
import { createToasterDriver } from '@/test-utils/drivers/toaster';
import { AuthorPortProvider, type AuthorPort } from '../api/author.port';
import { AuthorCard } from '../ui/AuthorCard';
import type { AuthorProfile } from '../model/types';
import { createAuthorCardDriver } from './driver';
import { createAuthorNet } from './net';

// No `vi.mock`, no module registry, no `vi.hoisted`. The widget takes its
// dependency from a provider, so a test swaps the implementation by mounting a
// different one — which means this file has no ordering constraints of any kind
// and can be imported like any other module.

export type AuthorCardKitOptions = {
  mswServer?: SetupServer;
  authorId?: string;
};

export function createAuthorCardKit({ mswServer, authorId = 'u_1' }: AuthorCardKitOptions = {}) {
  // ── The PORT transport ────────────────────────────────────────────────────
  // A typed spy behind the interface the widget owns. `vi.fn<AuthorPort['follow']>()`
  // breaks compilation when the port's signature changes; a bare `vi.fn()` does not.
  const follow = vi.fn<AuthorPort['follow']>();
  const port: AuthorPort = { follow };

  const net = createAuthorNet();
  const driver = createAuthorCardDriver();
  // A nested DRIVER, not a mock: the toast is where the error text actually
  // appears, so we borrow the Toaster's own assertions rather than stub it.
  const toaster = createToasterDriver();

  // ── Transports — internal, deliberately not exported ──────────────────────
  const actions = {
    succeeds: (followers = 129) => follow.mockResolvedValue({ success: true, followers }),
    rejects: (code: string, error: string) =>
      follow.mockResolvedValue({ success: false, code, error }),
    explodes: () => follow.mockRejectedValue(new Error('Network error')),
    neverSettles: () => follow.mockReturnValue(new Promise(() => {})),
  };

  // ── Domain vocabulary — the only surface a test should reach for ──────────
  const scenario = {
    // Note this moves TWO transports in one call. That is the whole reason the
    // scenario layer exists: a test says one domain fact, and the kit decides
    // what that means for the network AND for the port.
    authorExists: (patch: Partial<AuthorProfile> = {}) => {
      net.world.set(patch);
      actions.succeeds((patch.followers ?? 128) + 1);
    },
    authorAlreadyFollowed: () => {
      net.world.set({ isFollowedByViewer: true });
    },
    authorIsMissing: () => net.world.fails('notFound'),
    authorFeedIsDown: () => net.world.fails('serverError'),
    authorLoadsSlowly: (ms?: number) => net.world.slow(ms),
    followIsRejected: () =>
      actions.rejects('UNAUTHORIZED', 'You must be logged in to follow people.'),
    followServiceIsDown: () => actions.explodes(),
    followNeverSettles: () => actions.neverSettles(),
  };

  return {
    driver,
    scenario,
    toaster,

    /** For a HOST kit to mount this widget's dependency around its own tree. */
    wrap: (ui: ReactNode) => <AuthorPortProvider value={port}>{ui}</AuthorPortProvider>,

    /**
     * Escape hatch, exposed on purpose but rare. Use it only when the CALL
     * CONTRACT itself is the behaviour under test:
     *   expect(authorCard.actions.follow).not.toHaveBeenCalled()
     * Anything phrased "and then it shows / navigates / recovers" is an `assert`.
     */
    actions: { follow },

    assert: {
      ...driver.assert,
      followed: (name: string) => toaster.assert.waitForToast(`You are now following ${name}.`),
      followRejected: () => toaster.assert.waitForToast('You must be logged in to follow people.'),
      genericFailure: () => toaster.assert.waitForToast('Something went wrong. Please try again.'),
    },

    /** Standalone render. When nested, the HOST renders and calls `wrap`. */
    render: () =>
      customRender(
        <AuthorPortProvider value={port}>
          <AuthorCard authorId={authorId} />
        </AuthorPortProvider>,
      ),

    setup() {
      if (mswServer) mswServer.use(...net.handlers);
      scenario.authorExists();
    },

    /**
     * Runs AFTER the global `afterEach`, so the DOM is already unmounted and
     * MSW handlers are already reset. Release exactly what this kit owns —
     * never assert on the DOM here.
     */
    cleanup() {
      net.reset();
      follow.mockReset();
    },
  };
}
