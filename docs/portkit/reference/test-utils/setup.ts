import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { beforeAll, afterEach, afterAll } from 'vitest';

import { server } from './msw-server';
import { resetNextNavigation } from './next-navigation.mock';

/**
 * Global lifecycle. Referenced from `test.setupFiles` in `vitest.config.ts`.
 *
 * IMPORTANT ordering fact, measured: this `afterEach` runs BEFORE any fixture
 * teardown. By the time a kit's `cleanup()` executes, the DOM is unmounted and
 * MSW handlers are already reset — see `04-setup.md` §"The ordering trap".
 */
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetNextNavigation();
});

afterAll(() => server.close());
