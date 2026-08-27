'use client';

import { ConnectedAuthorPort } from '@/features/author-card/ui/ConnectedAuthorCard';

import { SpotlightPortProvider } from '../api/spotlight.port';
import { pinMessageAction } from '../api/pin-message.action';
import { MessageSpotlight } from './MessageSpotlight';

/**
 * A host feature knows its own dependency tree — INCLUDING its children's —
 * exactly as its kit does. Compare with the kit's `wrap()`:
 *
 *   wrap = (ui) => <SpotlightPortProvider value={port}>{author.wrap(ui)}</SpotlightPortProvider>
 *
 * Same nesting, one binding real and one fake. A route renders this and mounts
 * nothing itself.
 */
export function ConnectedMessageSpotlight(props: React.ComponentProps<typeof MessageSpotlight>) {
  return (
    <SpotlightPortProvider value={{ pin: pinMessageAction }}>
      <ConnectedAuthorPort>
        <MessageSpotlight {...props} />
      </ConnectedAuthorPort>
    </SpotlightPortProvider>
  );
}
