# TanStack Query

General notes on the library — how it behaves, and the shapes worth copying. What **this** repo
decided is in [`architecture/data-layer.md`](../architecture/data-layer.md); where those decisions
land against the feed is in [`inner/ARCHITECTURE.md`](../inner/ARCHITECTURE.md).

**Setting up**

| Document                                                 | Answers                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| [Wiring an API client in](./setup.md)                    | A global fetcher, and why components should not call the hooks directly |
| [SSR and hydration](./ssr.md)                            | Prefetch, dehydrate, and the handover to the client                     |
| [The double fetch on mount](./fetch-on-mount.md)         | Why it happens, why `staleTime` beats `refetchOnMount: false`           |
| [TanStack Query and Server Actions](./server-actions.md) | They compose — but use actions for writes, route handlers for reads     |

**Working with data**

| Document                                                        | Answers                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------- |
| [Shaping data, lists, and stores](./state-and-selectors.md)     | `select` instead of selectors; pagination; what Zustand is still for |
| [Mutations and optimistic updates](./mutations.md)              | Cancel, snapshot, write, roll back — and avoiding the extra GET      |
| [Reading query state](./query-states.md)                        | `isPending` vs `isFetching` vs `isStale`, and what to show           |
| [`placeholderData` / `keepPreviousData`](./placeholder-data.md) | What that option really does, and when it lies                       |
| [Polling](./polling.md)                                         | Including the dynamic form that stops when the job finishes          |

**Going deeper**

| Document                                  | Answers                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| [Offline and PWA](./offline-and-pwa.md)   | Persisting the cache, the Service Worker split, and turning caching off       |
| [How `useQuery` works](./how-it-works.md) | `useSyncExternalStore`, the observer, and where the fetch is really triggered |
