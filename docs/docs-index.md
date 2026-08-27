# Documentation index

**Start here**

| Document                                        | Answers                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Architecture](../ARCHITECTURE.md)              | The map — layers, what enforces them, and where each pattern is written up                   |
| [Implementation notes](./inner/ARCHITECTURE.md) | What this particular app does, and what the general rules look like once they hit real files |
| [Scripts](./scripts.md)                         | Every `pnpm` script, and which of them are CI gates                                          |

**[Architecture, in detail](./architecture/README.md)** — the expanded chapters of
`ARCHITECTURE.md`, not standalone guides

| Document                                                 | Answers                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`views/` and `server/`](./architecture/layer-naming.md) | Why two layer names deviate from stock FSD, and what each choice costs in lint coverage |
| [Lint rules](./architecture/lint-rules.md)               | The seven rules that fail a PR, and which tool holds each                               |
| [The data layer](./architecture/data-layer.md)           | Fetching, hydration, optimistic writes, invalidation, where failures are caught         |
| [Rendering](./architecture/rendering.md)                 | RSC vs client, per-route strategy, re-render discipline, keeping the bundle honest      |

**Structure**

| Document                                | Answers                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| [FSD in practice](./fsd-in-practice.md) | Is this a feature or a widget? May a view import a feature directly? Where does state live? |
| [Why knip runs in CI](./knip-in-ci.md)  | The dead-code gate — what it checks, and the hole it exists to close                        |

**Testing**

| Document                                          | Answers                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [TestKit for a component](./testkit-component.md) | **The approach we use.** How a component ships its own driver + harness, and how that survives a widget you do not own |
| [PortKit](./portkit/README.md)                    | Reference material only — a broader ports-and-fixtures approach, kept for comparison, not adopted                      |

**[Data fetching — TanStack Query](./tanstack-query/README.md)**

| Document                                                          | Answers                                                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [Handling API calls](./api/api-calls.md)                          | The hub — which transport for which job, and where each answer lives       |
| [Wiring an API client in](./tanstack-query/setup.md)              | A global fetcher, and the custom-hook layer above it                       |
| [SSR and hydration](./tanstack-query/ssr.md)                      | Prefetch, dehydrate, and when you do not need any of it                    |
| [The double fetch on mount](./tanstack-query/fetch-on-mount.md)   | Why it happens, and the trap in `refetchOnMount: false`                    |
| [Server Actions](./tanstack-query/server-actions.md)              | Actions for writes, route handlers for reads — and the `AbortSignal` catch |
| [Shaping data and lists](./tanstack-query/state-and-selectors.md) | `select`, pagination, infinite scroll, and what a store is still for       |
| [Mutations](./tanstack-query/mutations.md)                        | Optimistic updates, rollback, avoiding the extra GET                       |
| [Query state](./tanstack-query/query-states.md)                   | `isPending` vs `isFetching` vs `isStale`                                   |
| [`placeholderData`](./tanstack-query/placeholder-data.md)         | What the option really does, and when it lies                              |
| [Polling](./tanstack-query/polling.md)                            | Constant, background, and dynamic                                          |
| [Offline and PWA](./tanstack-query/offline-and-pwa.md)            | Persistence, Service Worker split, turning caching off                     |
| [How `useQuery` works](./tanstack-query/how-it-works.md)          | `useSyncExternalStore` and where the fetch is triggered                    |

**Next.js**

| Document                                                             | Answers                                                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Caching and server actions](./nextjs/caching-and-server-actions.md) | Server action or route handler? Which of the four Next caches you are talking about |
| [Cancelling a Server Action](./nextjs/aborting-server-actions.md)    | You cannot stop the server — but you can stop waiting                               |
| [Streaming UI](./streaming/streaming-ui.md)                          | Nine ways to stream into a React UI, with a decision tree                           |

**Forms**

| Document                                                      | Answers                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [Progressive enhancement](./forms/progressive-enhancement.md) | A form that submits before JS loads, `next-safe-action`, argument binding |
| [React Hook Form](./forms/react-hook-form.md)                 | Validation modes, why `isValid` surprises you, `watch` vs `useWatch`      |

**Language and platform**

| Document                                          | Answers                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| [TypeScript techniques](./typescript/tips.md)     | Branded types, type-level string parsing, partial type argument inference |
| [Flex `min-width: auto`](./css/flex-min-width.md) | Why a flex item refuses to shrink, and the one-line fix                   |
| [HTTPS on localhost](./infra/local-https.md)      | `mkcert`, per-framework setup, and when a tunnel is simpler               |
