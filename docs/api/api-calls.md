# Handling API calls

The entry point for "how do we talk to the backend". Everything below links to the page that actually
covers it — this file deliberately contains no code, so there is one place for each answer rather
than two that drift apart.

## Choosing a transport

| You are…                   | Use                                           | Why                                       |
| -------------------------- | --------------------------------------------- | ----------------------------------------- |
| Reading data               | a route handler (`GET`) behind TanStack Query | cacheable, `AbortSignal` works end to end |
| Writing data               | a Server Action, called from `useMutation`    | type-safe, no route to maintain           |
| Writing from a simple form | a Server Action + `useActionState`            | TanStack Query is overhead here           |

The reasoning, including why a Server Action as `queryFn` is an anti-pattern at scale:
[**TanStack Query and Server Actions**](../tanstack-query/server-actions.md).

Which write belongs in an action versus a route handler, and which of Next's caches each one touches:
[**Caching and server actions**](../nextjs/caching-and-server-actions.md).

## Setting it up

- **Wiring an API client in** — a global fetcher for SWR or TanStack Query, and why components should
  never call the hooks directly → [`tanstack-query/setup.md`](../tanstack-query/setup.md)
- **SSR and hydration** — prefetch, dehydrate, and the handover to the client →
  [`tanstack-query/ssr.md`](../tanstack-query/ssr.md)
- **The double fetch on mount** — why it happens and the one-line fix →
  [`tanstack-query/fetch-on-mount.md`](../tanstack-query/fetch-on-mount.md)

## Working with the data

- **Reshaping responses** — `select` as the replacement for Redux selectors; pagination and infinite
  lists; what a store is still for →
  [`tanstack-query/state-and-selectors.md`](../tanstack-query/state-and-selectors.md)
- **Mutations and optimistic updates** — cancel, snapshot, write, roll back →
  [`tanstack-query/mutations.md`](../tanstack-query/mutations.md)
- **Reading query state** — `isPending` vs `isFetching` vs `isStale`, and what to show the user →
  [`tanstack-query/query-states.md`](../tanstack-query/query-states.md)
- **Polling** — including the dynamic form that stops when the job finishes →
  [`tanstack-query/polling.md`](../tanstack-query/polling.md)

## Edge cases

- **Cancelling a Server Action** — you cannot stop the server, but you can stop waiting →
  [`nextjs/aborting-server-actions.md`](../nextjs/aborting-server-actions.md)
- **Offline and PWA** — persisting the cache, and the Service Worker split →
  [`tanstack-query/offline-and-pwa.md`](../tanstack-query/offline-and-pwa.md)
- **Turning caching off** — `gcTime: 0` and when that is actually justified →
  [`tanstack-query/offline-and-pwa.md`](../tanstack-query/offline-and-pwa.md#the-opposite-turning-caching-off)
- **How `useQuery` works underneath** — `useSyncExternalStore`, the observer, and where the fetch is
  really triggered → [`tanstack-query/how-it-works.md`](../tanstack-query/how-it-works.md)

## What this repo actually does

The pages above are general. The decisions made here — URL as view state, an unawaited prefetch,
client-generated ids, invalidating the key prefix — are in
[`architecture/data-layer.md`](../architecture/data-layer.md), and the shape they take against this
particular feed is in [`inner/ARCHITECTURE.md`](../inner/ARCHITECTURE.md).
