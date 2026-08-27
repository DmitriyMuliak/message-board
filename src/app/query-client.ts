import type { QueryClientConfig } from '@tanstack/react-query';

import { messageKeys, messageListQueryDefaults } from '@/entities/message';
import { makeQueryClient } from '@/shared/api/query-client';

/**
 * The one place per-resource query policy is installed. Every root that creates a
 * client goes through here — browser provider, RSC prefetch, test renderer — and
 * [`eslint.config.mjs`](../../eslint.config.mjs) rule 7 makes reaching for
 * `makeQueryClient` from anywhere else a lint error, because a root that bypasses
 * this one does not fail: it silently runs a different configuration.
 *
 * **Why this lives in `app/` and cannot live in `shared/`.** It needs `messageKeys`
 * from `entities`, and `shared` importing an entity is `Access to layer 'entities'
 * from 'shared' is denied`. The rule is downstream of the reason: `shared` is a
 * leaf, which is what lets it be lifted out whole, and `entities/message` already
 * imports `@/shared/config/constants` — so the reverse edge would close a
 * `shared → entities → shared` cycle by construction rather than by accident.
 * Beyond the graph, *which* resources behave *how* is a composition decision, and
 * `shared` does not know what application it is part of. These defaults used to sit
 * in `makeQueryClient`'s global options, where they also governed the user list;
 * this file is where that mistake was corrected, not repeated one level down.
 *
 * The legitimate way to move the loop into `shared` is inversion — have
 * `makeQueryClient` accept `[key, defaults]` pairs as data. It buys nothing today
 * (someone still has to hold the pairs, and that someone is still here), and it is
 * the shape to reach for when the list is ten entities long, not two.
 *
 * **What a bypassing root actually gets wrong**, since the answer is not "stale
 * data": cache defaults (`staleTime`, `gcTime`) do not travel with a prefetch —
 * `dehydrate()` ships data, key and `dataUpdatedAt`, and freshness after hydration
 * is computed by the browser client, which has them. What diverges is *behaviour*:
 * a per-resource `retry`, `queryFn`, `select` or `throwOnError` would apply in the
 * browser and quietly not in the RSC. And it bites in tests first — today's only
 * per-resource default is `placeholderData: keepPreviousData`, which is precisely
 * what a "changing a filter swaps the list in place instead of tearing it down to a
 * skeleton" test asserts. Before this factory, the test renderer did not have it.
 */
export function createAppQueryClient(config?: QueryClientConfig) {
  const client = makeQueryClient(config);
  client.setQueryDefaults(messageKeys.all, messageListQueryDefaults);
  return client;
}
