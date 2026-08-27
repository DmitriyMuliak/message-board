import { vi } from 'vitest';

/**
 * The Ambient transport: a stand-in for the router, wired in through
 * `resolve.alias` in `vitest.config.ts`.
 *
 * Because it is an alias rather than a `vi.mock`, `src` and the test resolve
 * the same module instance — the spies below are the ones the component under
 * test actually called, with no per-file boilerplate.
 *
 * This is the ONE place aliasing is the right tool: a bare vendor specifier has
 * exactly one spelling. Everything the application owns goes through a port.
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

// --- the surface `src/` consumes ---

export const useRouter = () => router;
/** A stable reference between renders, so `useMemo` deps do not thrash. */
export const useSearchParams = () => state.searchParams;
export const usePathname = () => state.pathname;
export const useParams = () => ({}) as Record<string, string>;

// --- test-only controls; a kit's `env` transport drives these ---

/** Seeds what `useSearchParams()` returns. Call BEFORE rendering. */
export function setSearchParams(init: string | Record<string, string> | URLSearchParams): void {
  state.searchParams = new URLSearchParams(init);
}

/** Seeds what `usePathname()` returns. Call BEFORE rendering. */
export function setPathname(pathname: string): void {
  state.pathname = pathname;
}

/** Clears call history *and* navigation state. Called from `setup.ts`. */
export function resetNextNavigation(): void {
  state.searchParams = new URLSearchParams();
  state.pathname = INITIAL_PATHNAME;

  for (const spy of [...Object.values(router), redirect, notFound]) {
    spy.mockReset();
  }
}
