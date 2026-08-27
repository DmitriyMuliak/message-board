import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';

const ROOT_TEST_ID = 'author-card';

/**
 * The only thing in a kit that touches the DOM.
 *
 * Three sub-layers: `elements` (selectors), `actions` (user intent), `assert`
 * (the accessibility contract). Nothing else in the kit queries the DOM, and
 * this file knows nothing about HTTP, the world, or the port.
 */
export function createAuthorCardDriver({ rootTestId = ROOT_TEST_ID } = {}) {
  const user = userEvent.setup();
  const getRoot = () => screen.getByTestId(rootTestId);

  const elements = {
    get root() {
      return within(getRoot());
    },
    /**
     * `/follow/i` matches "Follow", "Following…" AND "Following", so the query
     * survives the label swap while the action is in flight. A driver that
     * queried the exact current copy would throw in precisely the state most
     * worth asserting on.
     */
    get followButton() {
      return elements.root.getByRole('button', { name: /follow/i });
    },
    get followerCount() {
      return elements.root.getByTestId('author-followers');
    },
  };

  const actions = {
    async follow() {
      await user.click(elements.followButton);
    },
  };

  const assert = {
    /**
     * The root may not exist yet when this kit is nested inside a host that is
     * still loading its own data, so resolve it asynchronously before querying
     * inside it. Any assertion that can be the FIRST thing a test awaits needs
     * this; assertions already wrapped in `waitFor` are safe, because `waitFor`
     * retries on the throw.
     */
    async loaded(name: string) {
      await screen.findByTestId(rootTestId);
      await elements.root.findByText(name);
    },
    async following() {
      await waitFor(() => expect(elements.followButton).toHaveAccessibleName('Following'));
    },
    notFollowing() {
      expect(elements.followButton).toHaveAccessibleName('Follow');
    },
    async followers(count: number) {
      await waitFor(() => expect(elements.followerCount).toHaveTextContent(`${count} followers`));
    },
    async failedToLoad() {
      await screen.findByRole('alert');
    },
  };

  // `elements` must stay the Object.assign TARGET: its getters are lazy on
  // purpose, because the driver is constructed before `render()` runs.
  // Spreading instead (`{ ...elements, ...actions }`) evaluates every getter
  // right here, so `getRoot()` would query an empty DOM and throw. For the same
  // reason the members above close over `elements` rather than using `this`.
  return Object.assign(elements, actions, { assert });
}
