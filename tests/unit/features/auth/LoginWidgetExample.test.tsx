import { LoginWidgetExample } from './LoginWidgetExample';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/tests/unit/test-utils/msw-server';

import { LoginFormTestKit } from './LoginFormTestKit';
import { customRender } from '../../test-utils/customRender';
const onSuccess = vi.fn();

describe('LoginForm', () => {
  let formTestkit: ReturnType<typeof LoginFormTestKit>;

  beforeEach(() => {
    formTestkit = LoginFormTestKit();

    // Example of how to use harness to set up MSW handlers for the inner driver component under test.
    server.use(...formTestkit.harness.handlers);

    // Example of how to setup mock for server actions.
    // formTestkit.harness.installMockActions(); // Will use vitest.spy or Context for test runner agnostic mock.

    customRender(<LoginWidgetExample onSuccess={onSuccess} />);
  });

  it('blocks submission for a malformed email, leaving the valid password untouched', async () => {
    await formTestkit.driver.actions.loginAs('not-an-email@gmail.com', 'dispatch');

    await formTestkit.driver.assert.noFieldError('email');
    await formTestkit.driver.assert.noFieldError('password');

    // Example of how to use harness to set up a scenario for the component under test.
    formTestkit.harness.scenario.paymentDeclined();

    expect(onSuccess).not.toHaveBeenCalled();
  });
});
