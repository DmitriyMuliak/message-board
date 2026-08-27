# Implementation notes — DISPATCH

What this particular app does and why. The transferable half — how the codebase is organised, what
enforces it, and the data/rendering/testing patterns — is in
[`ARCHITECTURE.md`](../../ARCHITECTURE.md) at the root, and is not repeated here.

The app: a small team message board. Mock login, ≤240-character tagged messages, a feed filtered by
tag / author / date, cursor pagination, author-only inline edit and delete with optimistic UI and
rollback, and a virtualized list over 1200 seeded messages.

---

## Filtering

**The URL is the only source of truth** — the general form of this is in the root doc. What is
specific here:

- Three filter dimensions: `tags` (multi), `user` (single), and a `from`/`to` date range.
- `serializeFilters` produces the query string _and_ the stable part of the query key, so a filter
  set and its cache entry cannot disagree by construction.
- `normalizeFilters` parses whatever is in the URL and **degrades rather than throws**: unknown tags
  are dropped, an unparseable date becomes `null`, and a reversed range is swapped. The feed has to
  render for any URL a user can type or a stale bookmark can hold.
- The contract itself (`FeedFilters`, `serializeFilters`, `matchesFilters`) belongs to
  `entities/message` — it describes a message query. Only the URL binding lives in
  `features/feed-filters`. That split is what stopped the entity from importing the feature.
- **Filtering is server-side.** Filtering paginated pages on the client shows false-empty results:
  page 1 may contain nothing matching while page 4 does.

---

## Pagination

Cursor (keyset) plus an explicit **LOAD MORE** button.

The cursor is opaque `base64(createdAt|id)`. `createdAt` alone is not unique, hence the id
tiebreaker; base64 says "do not parse this", so the sort key can change later without breaking a
client that decided to.

A button rather than infinite scroll, for three reasons specific to this UI: the footer stays
reachable, a failed page has somewhere to live, and scroll-triggered fetching fights the virtualizer.
Swapping to infinite scroll is roughly ten lines and the data layer would not move.

---

## Permissions

**Permissions are server-driven.** Each message carries `permissions: { canEdit, canDelete }`; the
client renders actions from _that_, never from `author.id === session.id`. Ownership is an
authorization question and the client is not allowed to answer it.

The one client-side id comparison left is the avatar's "this is you" tint — decorative, so being
wrong costs nothing.

Because `permissions` are per-viewer, the feed response cannot be shared between users, which is what
rules out caching it (see Rendering strategy below).

---

## UI/UX decisions

- **One range picker, not two date inputs.** A calendar makes the invalid state _unrepresentable_ —
  you cannot pick an end before a start. Two text fields would mean parsing, locales, and "to < from"
  validation.
- **Two things load lazily, for different reasons.** `DateRangePicker` is **code-split**
  (`next/dynamic`) — it drags in `react-day-picker`, which nobody needs until they open it.
  `UserSelect` is not code-split but **owns its own query**: the user list is not part of the message
  contract, so the feed never waits on it.
- **`clamp()` for the login headline**, anchored on the two sizes the spec gives (52 px @ 390,
  88 px @ 1440). A breakpoint would jump; this scales.
- **Validation vs. toasts, split by who's at fault.** Field-level (empty, >240, bad email) → inline
  `role="alert"` wired to the input via `aria-describedby`. Request-level (`503`, network, bad
  credentials) → toast, because there is no field to blame.
- **Disable for no-ops, never for invalid.** Composer `POST` stays **enabled** when empty — empty is
  _invalid_, the user needs telling why, and a `disabled` button is out of the tab order and explains
  nothing. Editor `SAVE` **is** disabled when the text equals the original — unchanged is _valid but
  pointless_. (⌘+Enter bypasses a disabled button, so the same check also guards the submit handler.)
- **A message your filters would hide doesn't silently vanish.** It is run through `matchesFilters`
  first; if it would not show, we do not fake it into the list — we toast _"Posted — hidden by current
  filters"_. Optimistic UI may be optimistic about timing; it must not lie about where the data went.
- **Accessibility over pixel fidelity, deliberately.** The spec sets `outline: none`; we restore
  `:focus-visible`. The char counter is `sr-only` on mobile (the spec omits it) rather than `hidden`,
  so the live region still announces.

---

## Trade-offs specific to this app

| Decision                                   | Why                                                                                    | Accepted cost                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| HTTP + TanStack Query, not GraphQL         | One client, one resource — nothing to over-fetch, and status codes _are_ our UI states | Revisit if the card grows reactions or threads (OpenAPI codegen first) |
| In-memory seeded store, no database        | The brief is about the frontend; a deterministic seed makes the feed reviewable        | The store resets on restart                                            |
| `#fail` as a deterministic failure trigger | A reviewer can see the rollback path on demand instead of waiting for a random failure | One magic string in the mock backend                                   |

---

## The brief's bonus questions

**Rendering strategy.** `/auth/login` → **static** (no per-request data; the form is a client
island). `/` feed → **SSR, dynamic, streamed**: it depends on the session cookie _and_
`searchParams`, and `permissions` are per-viewer, so it cannot be cached. `/api/**` → route handlers,
uncached (mutations must be read-your-writes). **ISR fits nowhere here** — the feed is per-user ×
per-filter, so the key space explodes and nothing is shared. A public read-only permalink for one
message would be the ISR candidate.

**Bundle & re-renders as features grow.** The general discipline is in the root doc under Rendering.
Applied here: the date picker costs 0 bytes until opened, filters live in the URL rather than a
context that re-renders the subtree, RHF keeps the composer uncontrolled so typing re-renders the
counter and not the feed, and virtualization caps mounted rows regardless of feed length. Measurement
rather than guessing: the budget in [`.size-limit.js`](../../.size-limit.js) fails the build on
regression, and `pnpm analyze` says which route grew.

**"The feed feels janky."** The generic playbook is in the root doc. In _this_ codebase the first
thing to check is `ESTIMATED_ROW_HEIGHT`: if it has drifted from the measured median, `getTotalSize()`
lies, the scrollbar rubber-bands, and the list feels janky even at a steady 60 fps.

---

## Next steps

All were consciously time-boxed out of the challenge, not overlooked.

**1. CD — deployment.** [`verify.yml`](../../.github/workflows/verify.yml) runs `tsc` → `eslint` (the
architecture gate) → `knip` (the dead-code half of it) → `knip --production --strict` (the production
graph) → `prettier` → `vitest` → production `next build` → `size-limit` on every PR. The one thing
still missing is a `deploy` job: Vercel preview on PR, production on merge to `master`.

**2. E2E with Playwright.** No suite is committed; the first one to write covers the flow that spans
every layer — log in → filter → post → edit → delete → `#fail` rollback.

**3. Screenshot / visual-regression tests.** The brief grades design precision, and design
regressions are exactly what unit tests cannot see.

**4. Deeper unit coverage.** 32 tests today (login form, datetime, the global `next/navigation` mock,
the feed's error boundary, and the test-kit examples). Next up: the optimistic hooks' rollback, and
`useFeedFilters` ↔ URL round-tripping.

**5. i18n — a real string dictionary.** User-facing strings are inline in components. The intended
end state is that no component contains a literal — every string is a typed key in a dictionary,
which is then the seam `next-intl` (or similar) plugs into. There _was_ a `shared/config/copy.ts`
holding a half-written dictionary that nothing imported and that had already drifted from the real
copy; it has been deleted. An unused seam is not a head start, it is a second source of truth that
lies. The work starts when someone does the extraction for real.

**6. A `FormField` wrapper.** Label, error message, `aria-describedby` wiring and `sr-only` handling
are currently duplicated per-input (`Textarea`, and any future `Input`/`Select`). The fix is a
`FormField` component that owns that shared logic and composes a `shared/ui` primitive inside it, so
each primitive stays a plain, presentational field with no label or error concerns of its own.

**7. Run the commit-message linter's own tests.** `knip` surfaced this one:
`.husky/lint-commit-message/{formatter,validators}.test.mjs` are 10 passing `node:test` cases that
nothing executes — Vitest's `include` does not cover them, and no script or CI step invokes
`node --test`. They are declared as entry points in [`knip.jsonc`](../../knip.jsonc) so the tool does
not call a test file dead, which is true but not the same as running it. The fix is a `test:hooks`
script plus a step in `verify.yml`.

---

**Run it:** see [`README.md`](../../README.md). To demo the rollback, post a message containing
`#fail` — it deterministically returns `503`.
