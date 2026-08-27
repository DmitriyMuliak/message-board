import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
      const textElement = this.root.queryByText(message);
      return textElement?.parentElement || null;
    },
    getDismissButton(message: string | RegExp) {
      const toast = this.getToastElement(message);
      if (!toast) return null;
      return within(toast).queryByRole('button', { name: 'Dismiss notification' });
    },
  };

  const actions = {
    async dismissToast(message: string | RegExp) {
      const btn = elements.getDismissButton(message);
      if (!btn) throw new Error(`Cannot find dismiss button for toast with message: ${message}`);
      await user.click(btn);
    },
  };

  const assert = {
    async waitForToast(message: string | RegExp) {
      const textElement = await elements.root.findByText(message);
      return textElement.parentElement;
    },
  };

  return Object.assign(elements, { actions }, { assert });
};
