import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';

// Load .env.test (mode 'test') directly so the suite has SESSION_SECRET/
// MOCK_LATENCY_MS/etc. regardless of how vitest is invoked. The `pnpm
// test`/`test:run` scripts set these via `dotenv -e .env.test --`, but a
// bare `vitest`/`vitest run` call (e.g. an IDE test-runner extension)
// bypasses that wrapper entirely and previously failed on anything
// touching auth with "SESSION_SECRET environment variable is not set".
// Empty-string prefix loads every var, not just `VITE_`-prefixed ones
// (Vite's convention for non-client env).
const testEnv = loadEnv('test', process.cwd(), '');

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // `server-only` throws unless resolved under Next's `react-server` condition,
      // which Vitest doesn't set — swap in a no-op so node-env tests can import
      // anything under src/server without pulling in Next's bundler.
      'server-only': fileURLToPath(
        new URL('./tests/unit/test-utils/server-only-mock.ts', import.meta.url),
      ),
      // Global `next/navigation` mock. An alias (rather than a per-file
      // `vi.mock`, which is hoisted and file-scoped) means src and tests
      // resolve the *same* module instance, so a test can assert on the very
      // spies the component called. Reset in setup.ts's `afterEach`.
      'next/navigation': fileURLToPath(
        new URL('./tests/unit/test-utils/next-navigation.mock.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true, // For React Testing Library
    environment: 'jsdom',
    // Unit tests are co-located with what they test (`src/**`). What stays in
    // `tests/` is the shared harness — setup, msw, the `next/navigation` and
    // `server-only` mocks — which belongs to no slice, plus the one suite that
    // tests that harness itself (`next-navigation.mock.test.ts`). Hence both
    // roots: dropping the second would silently stop running it.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    setupFiles: ['./tests/unit/test-utils/setup.ts'],
    env: testEnv,
  },
});
