import { keepPreviousData } from '@tanstack/react-query';

import { PAGE_SIZE } from '@/shared/config/constants';

import { serializeFilters, type FeedFilters } from '../model/filters';

export const messageKeys = {
  all: ['messages'] as const,

  /**
   * The page size is **always** part of the key.
   * A default makes the key impossible to build wrong.
   */
  list: (f: FeedFilters, limit: number = PAGE_SIZE.default) =>
    ['messages', 'list', serializeFilters(f), limit] as const,
};

/**
 * Behaviour that belongs to *message* queries. The entity owns the policy; the
 * composition root owns installing it, via `setQueryDefaults(messageKeys.all, …)`
 * in [`app/query-client.ts`](src/app/query-client.ts) — the one factory every root
 * goes through, browser provider, RSC prefetch and test renderer alike. It used to
 * sit in `makeQueryClient`'s global defaults instead, where it also applied to the
 * user list and to every query added since.
 *
 * `keepPreviousData` is what makes a filter change swap the list in place
 * instead of tearing it down to a skeleton — skeletons are for cold loads.
 *
 * ⚠️ Sharp edge worth knowing: `UseSuspenseInfiniteQueryOptions` *omits*
 * `placeholderData`, so this cannot be passed to `useMessagesInfinite`
 * directly — a query default is the only place it type-checks. It does take
 * effect at runtime (unlike `useSuspenseQuery`, `useSuspenseInfiniteQuery`
 * doesn't reset it), but that is an inconsistency in the library, not a
 * contract. If TanStack ever aligns the two, the fallback is React's
 * `useTransition` around the filter write in `useFeedFilters`, which keeps the
 * old list mounted while the new one suspends.
 *
 * Full write-up — how the option works, where `previousData` actually lives, and
 * the ways it goes wrong: `TSQueryPrevDataGuide.md`.
 */
export const messageListQueryDefaults = {
  placeholderData: keepPreviousData,
};
