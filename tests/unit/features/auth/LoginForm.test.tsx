import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { rendererLoginForm } from './LoginFormTestKit';
import { createToasterDriver } from '../../shared/ui/Toast/ToasterTestkit';
import { router } from '@/tests/unit/test-utils/next-navigation.mock';
import { loginAction } from '@/features/auth/api/login.action';

vi.mock('@/features/auth/api/login.action', () => ({
  loginAction: vi.fn(),
}));

describe('LoginForm', () => {
  let formDriver: ReturnType<typeof rendererLoginForm>['driver'];
  let toasterDriver: ReturnType<typeof createToasterDriver>;

  beforeEach(() => {
    vi.mocked(loginAction).mockReset();

    const formRenderer = rendererLoginForm();
    formRenderer.render();

    formDriver = formRenderer.driver;
    toasterDriver = createToasterDriver();
  });

  it('blocks submission and shows inline errors for empty fields, without calling the API', async () => {
    await formDriver.submit();

    await formDriver.assert.fieldError('email', 'Email is required.');
    await formDriver.assert.fieldError('password', 'Password is required.');

    expect(loginAction).not.toHaveBeenCalled();
  });

  it('blocks submission for a malformed email, leaving the valid password untouched', async () => {
    await formDriver.loginAs('not-an-email', 'dispatch');

    await formDriver.assert.fieldError('email', 'Enter a valid email address.');
    await formDriver.assert.noFieldError('password');

    expect(loginAction).not.toHaveBeenCalled();
  });

  it('on success, calls loginAction then pushes to / and refreshes', async () => {
    vi.mocked(loginAction).mockResolvedValue({ success: true });

    await formDriver.loginAs('ada@dispatch.dev', 'dispatch');

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(loginAction).toHaveBeenCalledWith({
      email: 'ada@dispatch.dev',
      password: 'dispatch',
    });
  });

  it("on 401, shows a polite form-level banner with the server's generic message", async () => {
    vi.mocked(loginAction).mockResolvedValue({
      success: false,
      code: 'INVALID_CREDENTIALS',
      error: 'Incorrect email or password.',
    });

    await formDriver.loginAs('ada@dispatch.dev', 'wrong-password');
    await toasterDriver.assert.waitForToast('Incorrect email or password.');

    expect(toasterDriver.region).toHaveAttribute('aria-live', 'polite');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('on an unexpected failure, shows a generic form-level banner', async () => {
    vi.mocked(loginAction).mockRejectedValue(new Error('Network error'));

    await formDriver.loginAs('ada@dispatch.dev', 'dispatch');
    await toasterDriver.assert.waitForToast('Something went wrong. Please try again.');
  });
});
