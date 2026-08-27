# DISPATCH — Message Board

A small team message board: mock login, ≤240-char tagged messages, a feed filtered by
**tag / author / date** (filters live in the URL, so any view is shareable), cursor pagination,
author-only inline edit & delete with optimistic UI + rollback, and a virtualized list over
1200 seeded messages.

Built with **Next.js 16** (App Router), **React 19**, **TanStack Query v5**, **Tailwind v4**.

**This repo doubles as a reference.** It is a working application, and it is also where we keep worked
examples of how we do things — Feature-Sliced Design, the App Router, TanStack Query, testing. If you
came to see how a problem is solved rather than to run the app, start with these two:

- **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — how the code is organised, the lint rules that hold that
  organisation in place, and the data, rendering and testing patterns behind it. Nothing in it depends
  on the app being a message board.
- **[`docs/`](./docs/docs-index.md)** — the deeper dives, one per topic: FSD in practice, component
  test kits, `keepPreviousData`, the dead-code gate, every script. What _this_ app does and why is in
  [`docs/inner/ARCHITECTURE.md`](./docs/inner/ARCHITECTURE.md).

---

## Run it

Any package manager works; the commands below use pnpm.

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
pnpm format-check   # prettier
pnpm test:run       # vitest (once)
pnpm test           # vitest (watch)
pnpm size           # bundle budgets (needs a build first)
pnpm analyze        # interactive bundle explorer, by route (needs a build first)
```

Everything above except `dev`, `test` (watch) and `analyze` runs as a
[CI gate](./.github/workflows/verify.yml) — `lint-check` being the one that _enforces_ the
architecture rather than describing it. What each does, and why it blocks a merge:
[`docs/scripts.md`](./docs/scripts.md).

## Environment

See [`.env.example`](./.env.example) — three variables, all optional except `SESSION_SECRET`:

| Variable            | Default | Purpose                                                                     |
| ------------------- | ------- | --------------------------------------------------------------------------- |
| `SESSION_SECRET`    | —       | Signs the mock session JWT (HS256). Any long random string.                 |
| `MOCK_LATENCY_MS`   | `400`   | Simulated latency (±50% jitter) so loading/streaming states are reviewable. |
| `MOCK_FAILURE_RATE` | `0`     | Random mutation failure chance (0–1), on top of the `#fail` trigger.        |

---

## The mocked backend

There is no database. `src/server/` stands in for one, and it is deliberately shaped like the real
thing rather than like a fixture:

- **Route handlers are thin HTTP adapters** over the same service functions the RSC prefetch calls
  directly — that seam is the contract a backend team would implement.
- **`import 'server-only'`** makes a leak into client code a compile error, and a lint rule catches it
  one step earlier. Who may reach `src/server/**` is
  [rule 4](./ARCHITECTURE.md#rules-the-linter-checks).
- **The store resets on restart** — in-memory, seeded deterministically, so the feed is the same on
  every run.
