# Documentation index

| Document                                                            | Answers                                                                                        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Architecture](../ARCHITECTURE.md)                                  | How the code is organised, what enforces it, and the data/rendering patterns behind it         |
| [FSD in practice](./fsd-in-practice.md)                             | Is this a feature or a widget? May a view import a feature directly? Where does state live?    |
| [TestKit for a component](./testkit-component.md)                   | How a component ships its own driver + harness, and how that survives a widget you do not own  |
| [`placeholderData` / `keepPreviousData`](./TSQueryPrevDataGuide.md) | What that TanStack Query option actually does, and when it lies                                |
| [Why knip runs in CI](./knip-in-ci.md)                              | The dead-code gate — what it checks, and the hole it exists to close                           |
| [Scripts](./scripts.md)                                             | Every `pnpm` script, and which of them are CI gates                                            |
| [Implementation notes](./inner/ARCHITECTURE.md)                     | What this particular app does — its filters, pagination, permissions, UI decisions, next steps |
