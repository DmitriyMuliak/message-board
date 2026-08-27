import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';

const ROOT_TEST_ID = 'message-spotlight';

/**
 * The HOST's driver. It scopes to the host's own root, so it never collides
 * with the nested author card's queries — both use `within(root)`, and the two
 * roots are different nodes.
 */
export function createMessageSpotlightDriver({ rootTestId = ROOT_TEST_ID } = {}) {
  const user = userEvent.setup();
  const getRoot = () => screen.getByTestId(rootTestId);

  const elements = {
    get root() {
      return within(getRoot());
    },
    /** `/pin/i` matches "Pin", "Pinning…" and "Pinned" — the query survives the
     * label swap while the action is in flight. */
    get pinButton() {
      return elements.root.getByRole('button', { name: /pin/i });
    },
  };

  const actions = {
    async pin() {
      await user.click(elements.pinButton);
    },
  };

  const assert = {
    /** Resolves the root asynchronously: this is a top-level widget, but the
     * same rule applies to any driver whose assertion may run first. */
    async loaded(body: string) {
      await screen.findByTestId(rootTestId);
      await elements.root.findByText(body);
    },
    async pinned() {
      await waitFor(() => expect(elements.pinButton).toHaveAccessibleName('Pinned'));
    },
    async notPinned() {
      await waitFor(() => expect(elements.pinButton).toHaveAccessibleName('Pin'));
    },
    async failedToLoad() {
      await screen.findByRole('alert');
    },
  };

  return Object.assign(elements, actions, { assert });
}
