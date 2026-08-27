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

**Guides** — topics you would look up on their own

| Document                                                            | Answers                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [FSD in practice](./fsd-in-practice.md)                             | Is this a feature or a widget? May a view import a feature directly? Where does state live? |
| [Why knip runs in CI](./knip-in-ci.md)                              | The dead-code gate — what it checks, and the hole it exists to close                        |
| [Caching and server actions](./caching-and-server-actions.md)       | Server action or route handler? Which of the four Next caches you are talking about         |
| [`placeholderData` / `keepPreviousData`](./TSQueryPrevDataGuide.md) | What that TanStack Query option actually does, and when it lies                             |

**Testing**

| Document                                          | Answers                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [PortKit](./portkit/README.md)                    | The general approach: ports for dependencies, fixtures for lifecycle, MSW for the network   |
| [TestKit for a component](./testkit-component.md) | The narrower, MSW-only case, walked through the `LoginForm` kit that exists in `src/` today |
