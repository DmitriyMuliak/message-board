import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { customRender } from '@/tests/unit/test-utils/customRender';
import { LoginForm } from '@/features/auth/ui/LoginForm';
import { createWidgetHarness } from './LoginFormHarness';
import type { SetupServer as MSWSetupServer } from 'msw/node';

const defaultRenderParams = { overrideProps: {}, renderOptions: {} } as const;

type RendererOptions = {
  mswServer?: MSWSetupServer;
  overrideProps?: Partial<React.ComponentProps<typeof LoginForm>>;
  renderOptions?: Parameters<typeof customRender>[1];
};

export const rendererLoginForm = ({
  renderOptions,
  ...restParams
}: RendererOptions = defaultRenderParams) => {
  const { props, driver, testCycleMethods, harness } = LoginFormTestKit(restParams);

  return {
    render: () => {
      // Consumer will have it's own render method, and will use only the TestKit to get the props and driver.
      // The harness is used to set up MSW handlers for the component under test.
      return customRender(<LoginForm {...props} />, renderOptions);
    },
    props,
    driver,
    harness,
    testCycleMethods,
  };
};

type LoginFormTestKitParams = {
  overrideProps?: Partial<React.ComponentProps<typeof LoginForm>>;
  mswServer?: MSWSetupServer;
};

const defaultTestKitParams = {
  overrideProps: {},
  // mockActions: {}
} satisfies LoginFormTestKitParams;

export const LoginFormTestKit = ({
  overrideProps,
  mswServer,
}: LoginFormTestKitParams = defaultTestKitParams) => {
  const defaultProps = {};
  const harness = createWidgetHarness();
  const driver = createLoginFormDriver();
  const testCycleMethods = {
    // Setup/clean State for test, mocked Server API / browser API .etc
    onSetup: () => {
      mswServer?.use(...harness.handlers);
    },
    onCleanup: () => {},
  };

  return {
    props: { ...defaultProps, ...overrideProps },
    driver,
    testCycleMethods,
    harness,
  };
};

const FIELD_LABELS = {
  email: 'Email',
  password: 'Password',
} as const;

export type LoginFormField = keyof typeof FIELD_LABELS;

export const createLoginFormDriver = ({ rootTestId } = { rootTestId: 'login-form' }) => {
  const user = userEvent.setup();
  const getRoot = () => screen.getByTestId(rootTestId);

  const elements = {
    get root() {
      return within(getRoot());
    },
    input(field: LoginFormField) {
      return elements.root.getByLabelText(FIELD_LABELS[field]);
    },
    get emailInput() {
      return elements.input('email');
    },
    get passwordInput() {
      return elements.input('password');
    },
    get submitButton() {
      return elements.root.getByRole('button', { name: /log in/i });
    },
  };

  const actions = {
    async fillEmail(email: string) {
      await user.type(elements.emailInput, email);
    },

    async fillPassword(pass: string) {
      await user.type(elements.passwordInput, pass);
    },

    async submit() {
      await user.click(elements.submitButton);
    },

    async loginAs(email: string, pass: string) {
      await actions.fillEmail(email);
      await actions.fillPassword(pass);
      await actions.submit();
    },
  };

  const assert = {
    async fieldError(field: LoginFormField, message: string | RegExp) {
      const input = elements.input(field);
      await waitFor(() => {
        expect(input).toBeInvalid();
        expect(input).toHaveAccessibleDescription(message);
      });
    },

    noFieldError(field: LoginFormField) {
      expect(elements.input(field)).toBeValid();
    },
  };

  // `elements` must stay the Object.assign *target*: its getters are lazy on purpose, because the
  // driver is constructed before `render()` runs. Spreading instead (`{ ...elements, ...actions }`)
  // evaluates every getter right here, so `getRoot()` would query an empty DOM and throw.
  // For the same reason the members above close over `elements` rather than using `this` — a
  // destructured `const { submit } = driver` keeps working.
  return Object.assign(elements, { actions }, { assert });
};
