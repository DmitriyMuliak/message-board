import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // ── The Ambient transport ────────────────────────────────────────────
      // An ALIAS, not a per-file `vi.mock`. `vi.mock` is hoisted and scoped to
      // the file that calls it, so it cannot be declared once for every suite.
      // An alias makes `src`'s `import { useRouter } from 'next/navigation'`
      // and a test's import of the mock resolve to the SAME module instance —
      // so `router.push` in an assertion is literally the spy the component
      // called. Reset in setup.ts's `afterEach`.
      //
      // The rule this follows: ALIAS for bare/vendor specifiers, which have
      // exactly one spelling. NEVER alias a module inside `src/` — an alias
      // matches the import *string*, so `@/features/x/api/y` in a test and
      // `../api/y` in the component do not match, and you silently get two
      // live module instances with no error.
      'next/navigation': fileURLToPath(
        new URL('./test-utils/next-navigation.mock.ts', import.meta.url),
      ),

      // `server-only` throws unless resolved under the `react-server`
      // condition, which Vitest does not set. A no-op stub lets a node-env
      // test import server code without pulling in the framework bundler.
      'server-only': fileURLToPath(new URL('./test-utils/server-only-mock.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test-utils/setup.ts'],
    // `isolate: true` is the default and this approach relies on it: one module
    // graph per test FILE, so the ambient spies above are never shared across
    // files running in parallel. `isolate: false`, `poolOptions.*.singleFork`
    // or `it.concurrent` each break that and would require a per-test router
    // factory instead.
    isolate: true,
  },
});
