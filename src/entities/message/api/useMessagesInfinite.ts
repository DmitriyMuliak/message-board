'use client';

import { useSuspenseInfiniteQuery, type InfiniteData } from '@tanstack/react-query';

import { serializeFilters, type FeedFilters } from '@/features/feed-filters/model/filters';
import type { MessagesPage } from '@/entities/message/model/types';
import { apiService, ApiError } from '@/shared/api/http-client';

import { messageKeys } from './queries';

type MessagesQueryKey = ReturnType<typeof messageKeys.list>;
type MessagesPageParam = string | null;

import { apiRoutes } from '@/shared/api/routes';

function buildMessagesUrl(filters: FeedFilters, cursor: string | null, limit?: number): string {
  const parts: string[] = [];

  const filterQs = serializeFilters(filters);
  if (filterQs) {
    parts.push(filterQs);
  }
  if (cursor) {
    parts.push(`cursor=${encodeURIComponent(cursor)}`);
  }
  if (limit) {
    parts.push(`limit=${limit}`);
  }

  const base = apiRoutes.messages.base;
  return parts.length > 0 ? `${base}?${parts.join('&')}` : base;
}

/**
 * Client-side cursor pagination for messages, keyed by active filters.
 *
 * Hydrates automatically via `<HydrationBoundary>` during SSR.
 * Because the dehydrated state includes query keys, changing URL filters
 * naturally lands on a new key and fetches fresh data, preventing mismatch bugs.
 */
export function useMessagesInfinite(filters: FeedFilters, limit?: number) {
  return useSuspenseInfiniteQuery<
    MessagesPage,
    ApiError,
    InfiniteData<MessagesPage, MessagesPageParam>,
    MessagesQueryKey,
    MessagesPageParam
  >({
    queryKey: messageKeys.list(filters, limit),
    queryFn: ({ pageParam, signal }) =>
      apiService<MessagesPage>(buildMessagesUrl(filters, pageParam, limit), { signal }),
    getNextPageParam: (page) => page.nextCursor,
    initialPageParam: null,
  });
}
