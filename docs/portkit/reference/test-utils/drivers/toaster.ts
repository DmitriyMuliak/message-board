import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * A SHARED driver for a design-system component, owned by that component — not
 * by any feature kit.
 *
 * Feature kits borrow it (`const toaster = createToasterDriver()`) instead of
 * stubbing the toaster, because the toast is where a feature's error text
 * actually appears. Asserting on real markup rendered by the real component is
 * strictly better than asserting a mock was called.
 *
 * The a11y contract of this markup — `role="region"`, `aria-live="polite"` —
 * is asserted ONCE, in the Toaster's own test. A feature test asserting the
 * toaster's ARIA attributes is testing the wrong module.
 */
export const createToasterDriver = () => {
  const user = userEvent.setup();
  const getRoot = () => screen.getByRole('region', { name: 'Notifications' });

  const elements = {
    get root() {
      return within(getRoot());
    },
    get region() {
      return getRoot();
    },
    getToastElement(message: string | RegExp) {
      // Anchor to a role, never to DOM structure. `textElement.parentElement`
      // breaks the moment the text gains a wrapper.
      return elements.root.queryByText(message)?.closest('[role="status"]') ?? null;
    },
    getDismissButton(message: string | RegExp) {
      const toast = elements.getToastElement(message);
      if (!toast) return null;
      return within(toast as HTMLElement).queryByRole('button', {
        name: 'Dismiss notification',
      });
    },
  };

  const actions = {
    async dismissToast(message: string | RegExp) {
      const button = elements.getDismissButton(message);
      if (!button) throw new Error(`No dismiss button for toast: ${message}`);
      await user.click(button);
    },
  };

  const assert = {
    async waitForToast(message: string | RegExp) {
      return elements.root.findByText(message);
    },
  };

  return Object.assign(elements, actions, { assert });
};
