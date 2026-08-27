'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { serializeFilters, type FeedFilters } from '@/entities/message';

import { normalizeFilters } from './normalizeFilters';

interface UseFeedFiltersResult {
  /** Current filters parsed from the URL. Invalid URLs degrade gracefully. */
  filters: FeedFilters;
  /** Updates the URL via native `history.pushState` to avoid full RSC re-renders. */
  setFilters: (next: FeedFilters) => void;
}

/**
 * Manages feed filters using the URL as the single source of truth.
 *
 * - Uses native `window.history.pushState` instead of Next.js `router.push`.
 *   This prevents full server-side re-renders (RSC) on every filter click,
 *   allowing purely client-side fetching via React Query.
 * - Callers must be wrapped in a `<Suspense>` boundary due to `useSearchParams`.
 */
export function useFeedFilters(): UseFeedFiltersResult {
  const searchParams = useSearchParams();

  const filters = useMemo(() => normalizeFilters(searchParams), [searchParams]);

  const setFilters = useCallback((next: FeedFilters) => {
    const qs = serializeFilters(next);
    window.history.pushState(null, '', qs ? `?${qs}` : location.pathname);
  }, []);

  return { filters, setFilters };
}
