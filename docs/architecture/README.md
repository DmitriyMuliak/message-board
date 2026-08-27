# Architecture, in detail

The expanded chapters of [`ARCHITECTURE.md`](../../ARCHITECTURE.md). That file is the map — a
paragraph and a link per topic; these are the arguments behind it. They are grouped here so they do
not read as standalone guides: nothing in this folder is a topic you would look up on its own, only
a decision this codebase already made.

| Document                               | The question it settles                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| [`layer-naming.md`](./layer-naming.md) | Why `views/` and not `_pages`, and why `server/` sits outside the FSD layer stack  |
| [`lint-rules.md`](./lint-rules.md)     | The seven rules that fail a PR, and which tool holds each                          |
| [`data-layer.md`](./data-layer.md)     | Fetching, hydration, optimistic writes, invalidation, where failures are caught    |
| [`rendering.md`](./rendering.md)       | RSC vs client, per-route strategy, re-render discipline, keeping the bundle honest |

Standalone guides — FSD classification, the dead-code gate, caching, component testing — are one
level up, in [`docs/`](../docs-index.md). What this app specifically does is in
[`docs/inner/ARCHITECTURE.md`](../inner/ARCHITECTURE.md).
