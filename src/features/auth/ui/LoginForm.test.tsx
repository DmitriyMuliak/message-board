import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@tests/unit/test-utils/msw-server';

import { rendererLoginForm } from './LoginForm.testkit';
import { createToasterDriver } from '@/shared/ui/Toaster.testkit';
import { router } from '@tests/unit/test-utils/next-navigation.mock';
import { loginAction } from '@/features/auth/api/login.action';

vi.mock('@/features/auth/api/login.action', () => ({
  loginAction: vi.fn(),
}));

describe('LoginForm', () => {
  let formRenderer: ReturnType<typeof rendererLoginForm>;
  let formDriver: ReturnType<typeof rendererLoginForm>['driver'];
  let formScenario: ReturnType<typeof rendererLoginForm>['harness']['scenario'];
  let toasterDriver: ReturnType<typeof createToasterDriver>;

  beforeEach(() => {
    formRenderer = rendererLoginForm({ mswServer: server });
    formRenderer.testCycleMethods.onSetup();
    formRenderer.render();

    formDriver = formRenderer.driver;
    formScenario = formRenderer.harness.scenario;
    toasterDriver = createToasterDriver();
  });

  afterEach(() => {
    formRenderer.testCycleMethods.onCleanup();
  });

  it('blocks submission and shows inline errors for empty fields, without calling the API', async () => {
    await formDriver.actions.submit();

    await formDriver.assert.fieldError('email', 'Email is required.');
    await formDriver.assert.fieldError('password', 'Password is required.');

    expect(loginAction).not.toHaveBeenCalled();
  });

  it('blocks submission for a malformed email, leaving the valid password untouched', async () => {
    // Example of how to use harness to set up a scenario for the component under test.
    formScenario.paymentDeclined();

    await formDriver.actions.loginAs('not-an-email', 'dispatch');

    await formDriver.assert.fieldError('email', 'Enter a valid email address.');
    await formDriver.assert.noFieldError('password');

    expect(loginAction).not.toHaveBeenCalled();
  });

  it('on success, calls loginAction then pushes to / and refreshes', async () => {
    vi.mocked(loginAction).mockResolvedValue({ success: true });

    await formDriver.actions.loginAs('ada@dispatch.dev', 'dispatch');

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(loginAction).toHaveBeenCalledWith({
      email: 'ada@dispatch.dev',
      password: 'dispatch',
    });
  });

  // Example how to mock a server action and test the component's behavior on different responses.
  it("on 401, shows a polite form-level banner with the server's generic message", async () => {
    vi.mocked(loginAction).mockResolvedValue({
      success: false,
      code: 'INVALID_CREDENTIALS',
      error: 'Incorrect email or password.',
    });

    await formDriver.actions.loginAs('ada@dispatch.dev', 'wrong-password');
    await toasterDriver.assert.waitForToast('Incorrect email or password.');

    expect(toasterDriver.region).toHaveAttribute('aria-live', 'polite');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('on an unexpected failure, shows a generic form-level banner', async () => {
    vi.mocked(loginAction).mockRejectedValue(new Error('Network error'));

    await formDriver.actions.loginAs('ada@dispatch.dev', 'dispatch');
    await toasterDriver.assert.waitForToast('Something went wrong. Please try again.');
  });
});
