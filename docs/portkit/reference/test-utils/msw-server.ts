import { setupServer } from 'msw/node';

/**
 * One server for the whole run, started with NO handlers.
 *
 * Kits install their own handlers in `setup()` via `server.use(...)`, and the
 * global `afterEach` in `setup.ts` removes them again. Registering handlers
 * here instead would give every suite a world it did not ask for.
 */
export const server = setupServer();
