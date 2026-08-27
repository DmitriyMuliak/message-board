import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { computeAccessibleDescription } from 'dom-accessibility-api';
import { expect } from 'vitest';

export type Matcher = string | RegExp;

export type InputDriverOptions = {
  label: Matcher;
  container?: HTMLElement;
  user?: UserEvent;
};

/*
 * Detailed Driver example for Design System Testing Library:
 *
 * Why `dom-accessibility-api` and not a hand-rolled aria-describedby lookup:
 *
 * 1. It is the spec algorithm. Joining `textContent` off `aria-describedby` silently misses the
 *    `title` fallback and the `aria-description` attribute, and loses `alt` / nested `aria-label`
 *    because textContent is not text-alternative computation.
 * 2. It is what jest-dom's `toHaveAccessibleDescription` calls internally, so `state.description`
 *    and `assert.isInvalidWith` below stay one notion of "description" rather than two that can
 *    disagree on the same element.
 *
 * Pin `^0.6.3` — the range jest-dom uses. `@testing-library/dom` pins `^0.5.9`, so the two coexist
 * in the tree; matching jest-dom is what keeps state and assertions aligned. Declare it explicitly:
 * as a transitive dep it does not resolve from the project root under pnpm or Yarn PnP.
 *
 * Implements search logic - https://w3c.github.io/aria/accname/
 * computeAccessibleName │ aria-labelledby → aria-label → native (<label>, alt, caption, legend, placeholder) → title
 * computeAccessibleDescription │ aria-describedby → aria-description → title
 */

export const createInputDriver = ({
  label,
  container,
  user = userEvent.setup(),
}: InputDriverOptions) => {
  const queries = () => (container ? within(container) : screen);

  const element = {
    get: () => queries().getByLabelText<HTMLInputElement>(label), // default to exact match, throw if not found
    query: () => queries().queryByLabelText<HTMLInputElement>(label), // state.isPresent, assert.isAbsent
    find: () => queries().findByLabelText<HTMLInputElement>(label), // async, throws if not found
  };

  const state = {
    get value() {
      return element.get().value;
    },
    get isPresent() {
      return element.query() !== null;
    },
    get isDisabled() {
      return element.get().disabled;
    },
    get isReadOnly() {
      return element.get().readOnly;
    },
    get isRequired() {
      const el = element.get();
      return el.required || el.getAttribute('aria-required') === 'true';
    },
    get isInvalid() {
      return element.get().getAttribute('aria-invalid') === 'true';
    },
    get isBusy() {
      return element.get().getAttribute('aria-busy') === 'true';
    },
    get hasFocus() {
      return element.get().ownerDocument.activeElement === element.get();
    },
    get description() {
      return computeAccessibleDescription(element.get());
    },
  };

  const actions = {
    /** Replaces the current value. This is what a test almost always means. */
    async fill(value: string) {
      const el = element.get();
      await user.clear(el);
      if (value) await user.type(el, value);
    },
    /** Appends, keystroke by keystroke. Use for masks, autocomplete, char counters. */
    async type(value: string) {
      await user.type(element.get(), value);
    },
    async clear() {
      await user.clear(element.get());
    },
    async focus() {
      await user.click(element.get());
    },
    async blur() {
      element.get().blur();
    },
    async pressEnter() {
      await user.type(element.get(), '{Enter}');
    },
  };

  const assert = {
    hasValue(value: string) {
      expect(element.get()).toHaveValue(value);
    },
    isEmpty() {
      expect(element.get()).toHaveValue('');
    },
    /** Asserts the whole error contract, not just that a string is on screen. */
    isInvalidWith(message: Matcher) {
      expect(element.get()).toBeInvalid();
      expect(element.get()).toHaveAccessibleDescription(message);
    },
    isValid() {
      expect(element.get()).toBeValid();
    },
    isDisabled() {
      expect(element.get()).toBeDisabled();
    },
    isRequired() {
      expect(element.get()).toBeRequired();
    },
    hasFocus() {
      expect(element.get()).toHaveFocus();
    },
    isAbsent() {
      expect(element.query()).toBeNull();
    },
  };

  return { element, state, actions, assert };
};

export type InputDriver = ReturnType<typeof createInputDriver>;
