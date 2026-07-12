import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './msw-server';
import { resetNextNavigation } from './next-navigation.mock';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetNextNavigation();
});

afterAll(() => server.close());
