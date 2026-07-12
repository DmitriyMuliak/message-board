import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { customRender } from '@/tests/unit/test-utils/customRender';
import { LoginForm } from '@/features/auth/ui/LoginForm';

const defaultRenderParams = { overrideProps: {}, renderOptions: {} } as const;

export const rendererLoginForm = ({ renderOptions, ...restParams } = defaultRenderParams) => {
  const { props, driver, testMethods } = LoginFormTestKit(restParams);

  return {
    render: () => {
      testMethods.onSetup();
      return customRender(<LoginForm {...props} />, renderOptions);
    },
    props,
    driver,
    testMethods,
  };
};

type LoginFormTestKitParams = {
  overrideProps?: Partial<React.ComponentProps<typeof LoginForm>>;
};

const defaultTestKitParams = {
  overrideProps: {},
} satisfies LoginFormTestKitParams;

export const LoginFormTestKit = ({
  overrideProps,
}: LoginFormTestKitParams = defaultTestKitParams) => {
  const defaultProps = {};
  const testMethods = {
    // Call MSW handlers or other setup logic here if needed, setup/run mocked API .etc
    onSetup: () => {},
    onCleanup: () => {},
  };

  const driver = createLoginFormDriver();

  return {
    props: { ...defaultProps, ...overrideProps },
    driver,
    testMethods,
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

  return Object.assign(elements, actions, { assert });
};
