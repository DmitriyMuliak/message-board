import { vi } from 'vitest';

/**
 * Global stand-in for `next/navigation`, wired in through `resolve.alias` in
 * `vitest.config.ts` (same trick as `server-only`).
 *
 * Why an alias and not `vi.mock`: `vi.mock` is hoisted and scoped to the file
 * that calls it, so it cannot be declared once in `setup.ts` for every suite.
 * An alias makes `src`'s `import ... from 'next/navigation'` and a test's
 * import of this file resolve to the *same* module instance — so the spies
 * below are literally the ones the component under test called, with no
 * per-file boilerplate.
 *
 * `setup.ts` calls {@link resetNextNavigation} in `afterEach`, so navigation
 * state and call history never leak between tests.
 */

const INITIAL_PATHNAME = '/';

const state = {
  searchParams: new URLSearchParams(),
  pathname: INITIAL_PATHNAME,
};

/** The object `useRouter()` hands to components. Assert on these directly. */
export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

export const redirect = vi.fn();
export const notFound = vi.fn();

// --- the `next/navigation` surface that src/ consumes ---

export const useRouter = () => router;
/** Returns a stable reference between renders, so `useMemo` deps don't thrash. */
export const useSearchParams = () => state.searchParams;
export const usePathname = () => state.pathname;
export const useParams = () => ({}) as Record<string, string>;

// --- test-only controls ---

/** Seeds what `useSearchParams()` returns. Call before rendering. */
export function setSearchParams(init: string | Record<string, string> | URLSearchParams): void {
  state.searchParams = new URLSearchParams(init);
}

/** Seeds what `usePathname()` returns. Call before rendering. */
export function setPathname(pathname: string): void {
  state.pathname = pathname;
}

/** Clears call history *and* navigation state. Called from `setup.ts`'s `afterEach`. */
export function resetNextNavigation(): void {
  state.searchParams = new URLSearchParams();
  state.pathname = INITIAL_PATHNAME;

  for (const spy of [...Object.values(router), redirect, notFound]) {
    spy.mockReset();
  }
}
