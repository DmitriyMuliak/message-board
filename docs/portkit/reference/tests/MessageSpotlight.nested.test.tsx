import { describe, expect, test as base } from 'vitest';
import { messageSpotlightFixtures } from '@/features/message-spotlight/testkit/fixtures';

// ONE kit, ONE import. The consumer never learns that a spotlight contains an
// author card — the nested kit surfaces as a namespace on the parent.
const test = base.extend(messageSpotlightFixtures);

describe('MessageSpotlight', () => {
  test('pinning the message confirms it', async ({ messageSpotlight }) => {
    messageSpotlight.scenario.messageExists({ body: 'Hello world' });
    messageSpotlight.render();

    await messageSpotlight.driver.pin();

    await messageSpotlight.assert.pinConfirmed();
  });

  test('the embedded author card follows independently', async ({ messageSpotlight }) => {
    messageSpotlight.scenario.messageExists();
    messageSpotlight.author.scenario.authorExists({ name: 'Ada Lovelace' });
    messageSpotlight.render();

    await messageSpotlight.author.assert.loaded('Ada Lovelace');
    await messageSpotlight.author.driver.follow();

    await messageSpotlight.author.assert.following();
  });

  test('navigating to another message does not carry pinned state over', async ({
    messageSpotlight,
  }) => {
    messageSpotlight.scenario.messageExists();
    messageSpotlight.render();
    await messageSpotlight.driver.pin();
    await messageSpotlight.assert.pinConfirmed();

    // Re-render with a different id and NO remount — what a client-side link
    // does. Derived state held in `useState` would survive this and show the
    // next message as already pinned.
    messageSpotlight.showMessage('m_2');

    await messageSpotlight.assert.notPinned();
    expect(messageSpotlight.actions.pin).toHaveBeenCalledTimes(1);
  });
});
