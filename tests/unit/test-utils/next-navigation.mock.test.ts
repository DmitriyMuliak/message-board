import { describe, expect, it } from 'vitest';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

import { router, setSearchParams, setPathname } from './next-navigation.mock';

/**
 * Guards the two properties the global `next/navigation` alias exists for:
 * a test can reach the *same* spies `src/` calls, and nothing leaks across
 * tests. Test order matters here: each `dirties…` case is followed by a
 * `…starts clean` case asserting `setup.ts`'s `afterEach` undid it.
 */
describe('global next/navigation mock', () => {
  it('resolves the aliased module: `next/navigation` is the shared mock', () => {
    // What src/ imports...
    expect(useRouter()).toBe(router);
    // ...and what a test imports are one and the same instance.
    expect(useSearchParams()).toBeInstanceOf(URLSearchParams);
    expect(usePathname()).toBe('/');
  });

  it('dirties router spies and navigation state', () => {
    useRouter().push('/somewhere');
    setSearchParams({ tag: 'PRODUCT' });
    setPathname('/dirty');

    expect(router.push).toHaveBeenCalledWith('/somewhere');
    expect(useSearchParams().get('tag')).toBe('PRODUCT');
    expect(usePathname()).toBe('/dirty');
  });

  it('starts clean: call history and state were reset by afterEach', () => {
    expect(router.push).not.toHaveBeenCalled();
    expect([...useSearchParams().keys()]).toEqual([]);
    expect(usePathname()).toBe('/');
  });

  it('clears a custom implementation too (mockReset, not mockClear)', () => {
    router.prefetch.mockImplementation(() => {
      throw new Error('should not survive into the next test');
    });
    expect(() => useRouter().prefetch('/x')).toThrow();
  });

  it('starts clean: the custom implementation is gone', () => {
    expect(() => useRouter().prefetch('/x')).not.toThrow();
    expect(router.prefetch).toHaveBeenCalledTimes(1);
  });
});
