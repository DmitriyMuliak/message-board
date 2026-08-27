import { vi } from 'vitest';
import type { ReactNode } from 'react';
import type { SetupServer } from 'msw/node';

import { createAuthorCardKit } from '@/features/author-card/testkit';
import { customRender } from '@/test-utils/customRender';
import { createToasterDriver } from '@/test-utils/drivers/toaster';
import { SpotlightPortProvider, type SpotlightPort } from '../api/spotlight.port';
import { MessageSpotlight } from '../ui/MessageSpotlight';
import type { Spotlight } from '../model/types';
import { createMessageSpotlightDriver } from './driver';
import { createSpotlightNet } from './net';

/**
 * A HOST kit: MessageSpotlight renders AuthorCard, so this kit OWNS an author
 * kit. Same shape as the leaf, plus four things nesting adds.
 */
export type MessageSpotlightKitOptions = {
  mswServer?: SetupServer;
  messageId?: string;
};

export function createMessageSpotlightKit({
  mswServer,
  messageId = 'm_1',
}: MessageSpotlightKitOptions = {}) {
  const pin = vi.fn<SpotlightPort['pin']>();
  const port: SpotlightPort = { pin };

  const net = createSpotlightNet();
  const driver = createMessageSpotlightDriver();
  const toaster = createToasterDriver();

  // (1) The nested kit is constructed HERE, not composed by the test file.
  // A consumer should not have to know the widget tree to write a test about
  // pinning. Composing `base.extend(authorFixtures).extend(spotlightFixtures)`
  // in the test would leak exactly that structure.
  const author = createAuthorCardKit({ mswServer });

  const actions = {
    succeeds: () => pin.mockResolvedValue({ success: true }),
    rejects: (code: string, error: string) =>
      pin.mockResolvedValue({ success: false, code, error }),
    explodes: () => pin.mockRejectedValue(new Error('Network error')),
    neverSettles: () => pin.mockReturnValue(new Promise(() => {})),
  };

  const scenario = {
    messageExists: (patch: Partial<Spotlight> = {}) => {
      net.world.set(patch);
      actions.succeeds();
    },
    messageIsAlreadyPinned: () => net.world.set({ pinned: true }),
    messageIsMissing: () => net.world.fails('notFound'),
    pinIsRejected: () => actions.rejects('UNAUTHORIZED', 'You must be logged in to pin messages.'),
    pinServiceIsDown: () => actions.explodes(),
  };

  const view: { current: ReturnType<typeof customRender> | null } = { current: null };

  // (2) `wrap` composes providers — plain React composition, no hoisting, no
  // ordering rule. The host mounts its child's dependency too.
  const wrap = (ui: ReactNode) => (
    <SpotlightPortProvider value={port}>{author.wrap(ui)}</SpotlightPortProvider>
  );

  return {
    driver,
    scenario,
    toaster,
    /** (3) The nested kit, NAMESPACED. Never flattened — two children would
     * collide the moment both have a `succeeds()`. */
    author,
    wrap,
    actions: { pin },

    assert: {
      ...driver.assert,
      pinConfirmed: () => toaster.assert.waitForToast('Message pinned to the top of the feed.'),
      pinRejected: () => toaster.assert.waitForToast('You must be logged in to pin messages.'),
      genericFailure: () => toaster.assert.waitForToast('Something went wrong. Please try again.'),
    },

    /** Only the OUTERMOST kit calls `customRender`. */
    render: () => {
      view.current = customRender(wrap(<MessageSpotlight messageId={messageId} />));
    },

    /**
     * Point the mounted widget at another id WITHOUT remounting it — what a
     * client-side `<Link>` does in the app. Anything the widget derives from
     * `messageId` must survive this; local state does not.
     */
    showMessage: (nextMessageId: string) => {
      view.current?.rerender(wrap(<MessageSpotlight messageId={nextMessageId} />));
    },

    // (4) Lifecycle delegation is MANUAL and UNGUARDED. Vitest's fixture graph
    // knows nothing about `kit.author` — to the runner it is just data inside
    // this kit's value. Nothing warns you if you forget these calls: deleting
    // `author.setup()` fails tests with "Unable to find an element…", and no
    // error names the missing call.
    setup() {
      author.setup(); // children first: a later `server.use()` wins
      if (mswServer) mswServer.use(...net.handlers);
      scenario.messageExists();
    },
    cleanup() {
      net.reset();
      pin.mockReset();
      view.current = null;
      author.cleanup(); // reverse order
    },
  };
}
