import { describe, expect, test as base } from 'vitest';
import { authorCardFixtures } from '@/features/author-card/testkit/fixtures';

// A plain static import. No `vi.hoisted`, no module paths, no import-order
// constraint — the widget takes its dependency from a provider, so there is no
// module boundary to install before the imports evaluate.
const test = base.extend(authorCardFixtures);
// NOTE: no explicit generic. `base.extend<T>(obj)` binds `T` to Vitest 4's
// scoped-fixture overload, where the type parameter is a fixture NAME — the
// call still runs, but the context type silently loses every fixture.

describe('AuthorCard', () => {
  // The order is always: scenario → render → drive → assert.
  // `render()` is called by the TEST, never in a fixture or `beforeEach`, so
  // the world is already set before the component fetches on mount.
  test('renders the author it fetched on mount', async ({ authorCard }) => {
    authorCard.scenario.authorExists({ name: 'Ada Lovelace', followers: 128 });
    authorCard.render();

    await authorCard.assert.loaded('Ada Lovelace');
    await authorCard.assert.followers(128);
    authorCard.assert.notFollowing();
  });

  test('following the author flips the button and updates the count', async ({ authorCard }) => {
    authorCard.scenario.authorExists({ name: 'Ada Lovelace', followers: 128 });
    authorCard.render();
    await authorCard.assert.loaded('Ada Lovelace');

    await authorCard.driver.follow();

    await authorCard.assert.following();
    await authorCard.assert.followers(129);
    await authorCard.assert.followed('Ada Lovelace');
  });

  test('a rejected follow keeps the button actionable and explains why', async ({ authorCard }) => {
    authorCard.scenario.authorExists({ name: 'Ada Lovelace' });
    authorCard.scenario.followIsRejected();
    authorCard.render();
    await authorCard.assert.loaded('Ada Lovelace');

    await authorCard.driver.follow();

    await authorCard.assert.followRejected();
    authorCard.assert.notFollowing();
  });

  test('an exploding follow degrades to a generic message', async ({ authorCard }) => {
    authorCard.scenario.authorExists({ name: 'Ada Lovelace' });
    authorCard.scenario.followServiceIsDown();
    authorCard.render();
    await authorCard.assert.loaded('Ada Lovelace');

    await authorCard.driver.follow();

    await authorCard.assert.genericFailure();
  });

  test('a 404 on mount shows the error state and never offers the button', async ({
    authorCard,
  }) => {
    authorCard.scenario.authorIsMissing();
    authorCard.render();

    await authorCard.assert.failedToLoad();
    // The escape hatch, used correctly: the CALL CONTRACT is the behaviour.
    expect(authorCard.actions.follow).not.toHaveBeenCalled();
  });

  describe('for an author the viewer already follows', () => {
    // `test.scoped` overrides the options fixture for this describe only, and
    // every fixture depending on it is rebuilt with the new value.
    test.scoped({ authorCardOptions: { authorId: 'u_7' } });

    test('the button is inert from the first paint', async ({ authorCard }) => {
      authorCard.scenario.authorExists({ name: 'Grace Hopper' });
      authorCard.scenario.authorAlreadyFollowed();
      authorCard.render();

      await authorCard.assert.loaded('Grace Hopper');
      await authorCard.assert.following();
      expect(authorCard.driver.followButton).toBeDisabled();
    });
  });
});
