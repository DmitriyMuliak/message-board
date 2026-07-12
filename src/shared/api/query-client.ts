import {
  defaultShouldDehydrateQuery,
  keepPreviousData,
  QueryClient,
  type QueryClientConfig,
} from '@tanstack/react-query';

export function makeQueryClient(config: QueryClientConfig = {}): QueryClient {
  const { defaultOptions, ...rest } = config;

  return new QueryClient({
    ...rest,
    defaultOptions: {
      ...defaultOptions,
      dehydrate: {
        // By default only *settled* queries are dehydrated, which forces the
        // server to `await` a prefetch before it can ship anything — the whole
        // page then waits on the slowest query. Including `pending` queries lets
        // the server dehydrate the in-flight promise itself: the shell streams
        // immediately and the data lands when it resolves. `app/(main)/page.tsx`
        // relies on this to render the sidebar + composer without waiting for
        // `listMessages`.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
        ...defaultOptions?.dehydrate,
      },
      queries: {
        // Hydrated/fetched pages are treated as fresh for 30s — the feed
        // tolerates that much staleness, and it avoids an immediate
        // refetch-on-mount right after SSR hydration.
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
        // On filter change, keep showing the previous page's data (dimmed,
        // per the designed "previous data + progress" state) instead of
        // flashing a skeleton — skeletons are reserved for genuinely empty
        // (cold) loads.
        placeholderData: keepPreviousData,
        ...defaultOptions?.queries,
      },
      mutations: {
        // optimistic flows own their own failure UX (rollback + toast), so
        // auto-retrying a failed mutation would fight that, not help it.
        retry: 0,
        ...defaultOptions?.mutations,
      },
    },
  });
}
