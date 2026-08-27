# DISPATCH — Message Board

A small team message board: mock login, ≤240-char tagged messages, a feed filtered by
**tag / author / date** (filters live in the URL, so any view is shareable), cursor pagination,
author-only inline edit & delete with optimistic UI + rollback, and a virtualized list over
1200 seeded messages.

Built with **Next.js 16** (App Router), **React 19**, **TanStack Query v5**, **Tailwind v4**.

> **Why it's built this way → [`ARCHITECTURE.md`](./ARCHITECTURE.md)** — structure, key decisions
> (filtering, pagination, auth), UI/UX decisions, trade-offs, the challenge's bonus questions,
> and next steps. Start there.

---

## Run it

(you can use npm/yarn .etc)

```bash
pnpm install
cp .env.example .env      # any long random SESSION_SECRET works locally
pnpm dev                  # http://localhost:3000
```

No database — the store is in-memory and seeded deterministically.

## Log in

Every seeded user shares the same demo password: **`dispatch`**

| Email                | User                  |
| -------------------- | --------------------- |
| `ada@dispatch.dev`   | Ada Lovelace (@ada_l) |
| `marco@dispatch.dev` | Marco Diaz (@marco)   |
| `priya@dispatch.dev` | Priya Shah (@priya)   |

## See the rollback

Post a message containing **`#fail`** — the mock API deterministically returns `503`, the
optimistic row rolls back, a toast offers a retry, and your text stays in the composer.

---

## Scripts

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
in `app/query-client.ts`. The same command runs in [CI](.github/workflows/verify.yml), so a PR that
breaks the architecture fails before review. The seven rules are listed in
[`ARCHITECTURE.md` → Rules the linter checks](./ARCHITECTURE.md#rules-the-linter-checks).

`pnpm knip` is the eighth rule and the one ESLint cannot hold: whether anything actually imports what a
slice's `index.ts` promises. It also runs in CI. An export that is unimported on purpose says so with
a `@public` tag — same section for the policy. `pnpm knip:production` is its companion: it walks the
production graph only, so a test package reaching production code is caught even when it is a package
nobody put on a deny-list.

`pnpm size` is the bundle gate; `pnpm analyze` is its diagnostic half. Next 16 removed per-route build
stats — the route table has no `First Load JS` column, and Turbopack (the default bundler for
`next build` since 16) emits no `app-build-manifest.json`, so no route → chunk mapping survives to be
measured ([vercel/next.js#85712](https://github.com/vercel/next.js/issues/85712)). The budgets in
[`.size-limit.js`](./.size-limit.js) therefore gate the whole client output, which is what fails CI
when a dependency moves it; `pnpm analyze` then opens Turbopack's module graph — filtered by route,
with the import chain explaining why a module is there — to say which route it was. It is
interactive-only and experimental, so it stays out of CI.

Unit tests sit next to what they test (`LoginForm.tsx`, `LoginForm.test.tsx`,
`LoginForm.testkit.tsx`). [`tests/`](./tests) keeps only the harness that belongs to no slice — setup,
msw, the `next/navigation` and `server-only` mocks — imported as `@tests/…`.

For a broader second opinion, `pnpm dlx steiger ./src` gives an advisory FSD audit — it is not a
dependency and not a gate; see the same section for why.

## Environment

See [`.env.example`](./.env.example) — three variables, all optional except `SESSION_SECRET`:

| Variable            | Default | Purpose                                                                     |
| ------------------- | ------- | --------------------------------------------------------------------------- |
| `SESSION_SECRET`    | —       | Signs the mock session JWT (HS256). Any long random string.                 |
| `MOCK_LATENCY_MS`   | `400`   | Simulated latency (±50% jitter) so loading/streaming states are reviewable. |
| `MOCK_FAILURE_RATE` | `0`     | Random mutation failure chance (0–1), on top of the `#fail` trigger.        |

---

## Tests

Vitest + React Testing Library (jsdom), MSW at the network boundary. **Example of component tests:**

- `features/auth/LoginForm.test.tsx` — validation, submit, redirect; asserts field errors through the
  **accessibility wiring** (`aria-invalid` + `aria-describedby`), not a bare text query. Also used approach with testkit entity(for mocks/complex logic in case of integration testing) + driver entity (for interaction).

Gaps I'd close first are listed in [`ARCHITECTURE.md` → Next steps](./ARCHITECTURE.md#next-steps):
the optimistic hooks' rollback, `useFeedFilters` ↔ URL round-tripping, and the route-handler contract.

## Deliberate deviations from the design spec

| Deviation                            | Why                                                                                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `:focus-visible` outlines restored   | The spec sets `outline: none`. Shipping that is an a11y failure — a11y wins over pixels.                                                                                                                        |
| Two-step DELETE (`DELETE` → `SURE?`) | The spec doesn't design a confirm step. No modal ceremony; keyboard-accessible.                                                                                                                                 |
| Error & empty states invented        | Undesigned; built in the spec's visual idiom.                                                                                                                                                                   |
| Char counter shown on mobile too     | The spec hides it there, but `POST` stays enabled when oversized (by design — see `ARCHITECTURE.md`); without the visible count, an oversized submit silently does nothing and the user has no way to tell why. |

Everything else was **measured** against the spec's computed styles rather than eyeballed.

---

## Notes for a reviewer

- **`src/server/` is the mocked backend.** Route handlers are thin HTTP adapters over the same service functions the RSC prefetch calls directly — the contract a backend team would implement.
- **The store resets on restart** (in-memory, seeded).
