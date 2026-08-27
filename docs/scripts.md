# Scripts

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm typecheck      # tsc --noEmit
pnpm lint-check     # eslint — also the architecture gate (see below)
pnpm knip           # dead code: unused exports, files, dependencies
pnpm knip:production # devDependencies reaching production code
pnpm test:run       # vitest (once)
pnpm test           # vitest (watch)
pnpm size           # bundle budgets (needs a build first)
pnpm analyze        # interactive bundle explorer, by route (needs a build first)
```

`pnpm lint-check` is where the Feature-Sliced rules are enforced, not just described: layer
direction, no sibling-slice imports, slice public APIs, who may reach `src/server/**`, that
production code never imports a test, and that every TanStack Query client comes from the one factory
in `app/query-client.ts`. The same command runs in [CI](../.github/workflows/verify.yml), so a PR that
breaks the architecture fails before review. The seven rules are listed in
[`lint-rules.md`](./lint-rules.md).

`pnpm knip` is the eighth rule and the one ESLint cannot hold: whether anything actually imports what a
slice's `index.ts` promises. It also runs in CI. An export that is unimported on purpose says so with
a `@public` tag — same section for the policy. `pnpm knip:production` is its companion: it walks the
production graph only, so a test package reaching production code is caught even when it is a package
nobody put on a deny-list.

`pnpm size` is the bundle gate; `pnpm analyze` is its diagnostic half. Next 16 removed per-route build
stats — the route table has no `First Load JS` column, and Turbopack (the default bundler for
`next build` since 16) emits no `app-build-manifest.json`, so no route → chunk mapping survives to be
measured ([vercel/next.js#85712](https://github.com/vercel/next.js/issues/85712)). The budgets in
[`.size-limit.js`](../.size-limit.js) therefore gate the whole client output, which is what fails CI
when a dependency moves it; `pnpm analyze` then opens Turbopack's module graph — filtered by route,
with the import chain explaining why a module is there — to say which route it was. It is
interactive-only and experimental, so it stays out of CI.

Unit tests sit next to what they test, and a slice's whole testing surface is named by suffix:
`.test.` (the suite), `.testkit.` (props + driver + lifecycle), `.harness.` (the world it talks to —
MSW handlers and a scenario vocabulary), `.fixture.` (a stand-in component a suite mounts). Those
four suffixes are what ESLint and knip use to tell test-side code from production code now that the
directory no longer does — a file that forgets one is treated as production and fails the rule that
bans importing `msw`. [`tests/`](../tests) keeps only the harness that belongs to no slice — setup,
msw, the `next/navigation` and `server-only` mocks — imported as `@tests/…`. The pattern, and how a
kit survives being wrapped by a widget you do not own, is written up in
[`testkit-component.md`](./testkit-component.md).

For a broader second opinion, `pnpm dlx steiger ./src` gives an advisory FSD audit — it is not a
dependency and not a gate; see the same section for why.
