# The rules the linter checks

Prose does not hold an architecture. These seven are lint errors in
[`eslint.config.mjs`](../../eslint.config.mjs), run by husky/lint-staged locally and by
[CI](../../.github/workflows/verify.yml) on every PR. A PR that breaks the architecture fails before
review.

1. **A layer imports only from layers strictly below it.** `entities` may not see `features`.
2. **A slice may not import a sibling slice on its own layer.** Need both? That is what a `widget` is
   for — `widgets/message-card` is where `entities/message` and the edit/delete features get stitched
   together.
3. **A slice is imported through its `index.ts`.** `@/features/message-edit`, never
   `@/features/message-edit/api/useEditMessageMutation`.
4. **`@/server/**` is importable only from `app/**` and `*.action.ts`.**
5. **`shared/` imports nothing from the app.** It is a leaf, and a leaf with dependencies is just a
   layer with a misleading name.
6. **Production code imports no tests.** Not `vitest`, not `@testing-library/*`, not `@tests/…`, not a
   `*.test.*`, `*.testkit.*`, `*.harness.*` or `*.fixture.*` file. The direction is one-way and only
   one way.
7. **Query clients come from one factory.** `createAppQueryClient` in
   [`app/query-client.ts`](../../src/app/query-client.ts) — nothing else may import `makeQueryClient`,
   the file itself excepted.

Rules 1–2 come from
[`eslint-plugin-import-fsd`](https://www.npmjs.com/package/eslint-plugin-import-fsd); 3–7 are native
`no-restricted-imports` patterns, no extra dependency. Why the plugin can hold 1–2 for `views/` but
not for `server/` is in [`layer-naming.md`](./layer-naming.md).

**There is an eighth**, and it needs a different tool: whether anything actually imports what a
barrel promises is a module-graph question, which ESLint structurally cannot answer. `knip` does —
see [`knip-in-ci.md`](../infra/knip-in-ci.md).

Tests are deliberately exempt from rules 1–6, and not from 7. Why each rule exists, what it caught,
and how the exemption is wired:
[`inner/ARCHITECTURE.md` → Why each rule exists](../inner/ARCHITECTURE.md#why-each-rule-exists).
