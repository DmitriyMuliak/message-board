import { server } from '@/test-utils/msw-server';
import type { KitFixtures } from '@/test-utils/testkit';
import { createMessageSpotlightKit, type MessageSpotlightKitOptions } from './index';

export type MessageSpotlightFixtures = {
  messageSpotlightOptions: MessageSpotlightKitOptions;
  messageSpotlight: ReturnType<typeof createMessageSpotlightKit>;
};

/**
 * No `Deps` type argument: the nested author kit is this kit's own business.
 * A consumer composes ONE fixtures object and never learns the widget tree.
 */
export const messageSpotlightFixtures: KitFixtures<MessageSpotlightFixtures> = {
  messageSpotlightOptions: {},

  messageSpotlight: async ({ messageSpotlightOptions }, provide) => {
    const kit = createMessageSpotlightKit({ mswServer: server, ...messageSpotlightOptions });
    kit.setup();
    await provide(kit);
    kit.cleanup();
  },
};
