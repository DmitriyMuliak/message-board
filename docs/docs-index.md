# Documentation index

**Start here**

| Document                                        | Answers                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Architecture](../ARCHITECTURE.md)              | How the code is organised, what enforces it, and the data/rendering patterns behind it         |
| [Implementation notes](./inner/ARCHITECTURE.md) | What this particular app does — its filters, pagination, permissions, UI decisions, next steps |
| [Scripts](./scripts.md)                         | Every `pnpm` script, and which of them are CI gates                                            |

**Structure**

| Document                                | Answers                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| [FSD in practice](./fsd-in-practice.md) | Is this a feature or a widget? May a view import a feature directly? Where does state live? |
| [Why knip runs in CI](./knip-in-ci.md)  | The dead-code gate — what it checks, and the hole it exists to close                        |

**Testing**

| Document                                          | Answers                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [PortKit](./portkit/README.md)                    | The general approach: ports for dependencies, fixtures for lifecycle, MSW for the network   |
| [TestKit for a component](./testkit-component.md) | The narrower, MSW-only case, walked through the `LoginForm` kit that exists in `src/` today |

**Data and caching**

| Document                                                            | Answers                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [Caching and server actions](./caching-and-server-actions.md)       | Server action or route handler? Which of the four Next caches you are talking about |
| [`placeholderData` / `keepPreviousData`](./TSQueryPrevDataGuide.md) | What that TanStack Query option actually does, and when it lies                     |
