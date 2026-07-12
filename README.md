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
pnpm lint-check     # eslint
pnpm test:run       # vitest (once)
pnpm test           # vitest (watch)
```

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

| Deviation                            | Why                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `:focus-visible` outlines restored   | The spec sets `outline: none`. Shipping that is an a11y failure — a11y wins over pixels. |
| Two-step DELETE (`DELETE` → `SURE?`) | The spec doesn't design a confirm step. No modal ceremony; keyboard-accessible.          |
| Error & empty states invented        | Undesigned; built in the spec's visual idiom.                                            |
| Char counter is `sr-only` on mobile  | The spec omits it there, but it's an `aria-live` region — `hidden` would silence it.     |

Everything else was **measured** against the spec's computed styles rather than eyeballed.

---

## Notes for a reviewer

- **`src/server/` is the mocked backend.** Route handlers are thin HTTP adapters over the same service functions the RSC prefetch calls directly — the contract a backend team would implement.
- **The store resets on restart** (in-memory, seeded).
