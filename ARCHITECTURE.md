# ARCHITECTURE

---

## Structure

Feature-Sliced-ish. Dependencies point one way: `app → views → widgets → features → entities → shared`.

```
src/
  app/       Next surface only: RSC pages, route handlers, proxy.ts
  views/     page composition (FeedView)
  widgets/   standalone blocks (Header)
  features/  capabilities (auth, feed-filters, message-compose/edit/delete)
  entities/  domain + its UI (message, MessageCard, query keys)
  shared/    primitives with no domain knowledge (ui, lib, api, config)
  server/    "the backend": in-memory db, services, auth, latency simulation
```

The boundary that earns its keep is **domain vs. reusable**: `shared/ui/Button` knows nothing about
messages; `MessageCard` knows nothing about filters. `server/` is imported only by route handlers
and RSCs — `import 'server-only'` makes a leak a compile error.

**One zod schema** validates the composer form _and_ the route handler. One definition, no drift —
that schema is the artifact you'd hand a backend team.

---

## Key decisions

**Filtering — the URL is the only source of truth.** No filter state in React: components read
`useSearchParams()`, interactions write `window.history.pushState`. Shareable/bookmarkable comes free
because there was never a second copy to sync. `pushState` (not `router.push`) means a chip tap does
**not** re-run the RSC. Filtering is server-side — client-filtering paginated pages shows false-empty
results.

**Pagination — cursor (keyset) + "LOAD MORE" button.** The feed appends at the top, so with
`LIMIT/OFFSET` a message posted while you read page 1 makes page 2 repeat a row, and a delete makes
it skip one. The cursor is opaque `base64(createdAt|id)`: `createdAt` alone isn't unique, and base64
says "don't parse this" so the sort key can change later without breaking clients. A button rather
than infinite scroll: the footer stays reachable, failure has somewhere to live, and scroll-triggered
fetching fights the virtualizer. Swapping to infinite scroll is ~10 lines — the data layer wouldn't move.

**Permissions are server-driven.** Each message carries `permissions: { canEdit, canDelete }`; the
client renders actions from _that_, never from `author.id === session.id`. Ownership is an
authorization question and the client isn't allowed to answer it. The one client-side id comparison
is the avatar's "this is you" tint — decorative, so being wrong costs nothing.

**Data — TanStack Query, hydrated _with its key_.** The RSC prefetches page 1 into a per-request
`QueryClient` and ships it via `dehydrate()` + `<HydrationBoundary>`. The prefetch is **not awaited**:
the pending query is dehydrated, so the shell streams immediately and the feed slot fills when data
resolves (measured: ~100 ms vs ~1.4 s under 1.2 s of mock latency). Because dehydrated data carries
its query key, a filter change simply lands on a different key and refetches. An earlier `initialData`
version was keyless, seeded the wrong cache entry, and rendered a `?tags=PRODUCT` feed full of
non-PRODUCT messages.

**Optimistic mutations.** `onMutate` cancels in-flight queries (else a landing refetch clobbers the
write), snapshots the cache, then writes; `onError` restores the snapshot wholesale. The **client
generates the message id**, which buys two things: the server echoes it back, so `onSuccess` swaps in
place — same id → same virtualizer key → **no remount, no scroll jump** — and the POST is idempotent,
so a retry can't double-post. `retry: 0` on mutations: an auto-retry would fire after the rollback and
fight it.

---

## UI/UX decisions

- **One range picker, not two date inputs.** A calendar makes the invalid state _unrepresentable_ — you cannot pick an end before a start. Two text fields would mean parsing, locales, "to < from" validation.
- **Two things load lazily, for different reasons.** `DateRangePicker` is **code-split** (`next/dynamic`) — it drags in `react-day-picker`, which nobody needs until they open it. `UserSelect` isn't code-split but **owns its own query**: the user list isn't part of the message contract, so the feed never waits on it.
- **`clamp()` for the login headline**, anchored on the two sizes the spec gives (52px @390, 88px @1440). A breakpoint would jump; this scales.
- **Validation vs. toasts, split by who's at fault.** Field-level (empty, >240, bad email) → inline `role="alert"` wired to the input via `aria-describedby`. Request-level (`503`, network, bad credentials) → toast, because there's no field to blame.
- **Disable for no-ops, never for invalid.** Composer `POST` stays **enabled** when empty — empty is _invalid_, the user needs telling why, and a `disabled` button is out of the tab order and explains nothing. Editor `SAVE` **is** disabled when the text equals the original — unchanged is _valid but pointless_. (⌘+Enter bypasses a disabled button, so the same check also guards the submit handler.)
- **A message your filters would hide doesn't silently vanish.** It's run through `matchesFilters` first; if it wouldn't show, we don't fake it into the list — we toast _"Posted — hidden by current filters"_. Optimistic UI may be optimistic about timing; it must not lie about where the data went.
- **Accessibility over pixel fidelity, deliberately.** The spec sets `outline: none`; we restore `:focus-visible`. The char counter is `sr-only` on mobile (the spec omits it) rather than `hidden`, so the live region still announces.
- **Design fidelity was measured, not eyeballed** — computed styles compared against the spec. Its webfonts fail to load offline, so screenshot-only comparison is actively misleading; it cost me one wrong "fix" before I caught it.

---

## Trade-offs

| Decision                                       | Why                                                                                                                                                          | Accepted cost                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `history.pushState`, not `router.push`         | No RSC round-trip per chip tap                                                                                                                               | Server never learns filters changed → SSR data must be keyed carefully                                                  |
| `HydrationBoundary`, not `initialData`         | Data travels with its query key; wrong-cache-entry bugs become impossible                                                                                    | A per-request `QueryClient` on the server                                                                               |
| Prefetch not awaited (pending query streamed)  | Shell paints in ~100 ms instead of waiting on the feed                                                                                                       | Must opt `shouldDehydrateQuery` into pending queries                                                                    |
| Virtualized, but plain flow until mount        | During SSR the virtualizer has no viewport rect → zero rows, then overlapping ones                                                                           | One extra pre-paint render on mount                                                                                     |
| Cursor + LOAD MORE button                      | Offset breaks under this app's own optimistic create/delete                                                                                                  | No auto-load convenience                                                                                                |
| HTTP + TanStack Query, not GraphQL             | One client, one resource — nothing to over-fetch; status codes _are_ our UI states                                                                           | Revisit if the card grows reactions/threads (OpenAPI codegen first)                                                     |
| Invalidate `messageKeys.all` on every mutation | Other cached filter combinations still hold the pre-mutation list; without this, a message deleted under `?tags=PRODUCT` reappears when you clear the filter | Almost none — `invalidateQueries` only _marks_ stale (`refetchType: 'active'`), so only the one mounted query refetches |

---

## Bonus questions

**Rendering strategy.** `/auth/login` → **static** (no per-request data; the form is a client island).
`/` feed → **SSR, dynamic, streamed**: it depends on the session cookie _and_ `searchParams`, and
`permissions` are per-viewer, so it can't be cached. `/api/**` → route handlers, uncached (mutations
must be read-your-writes). **ISR fits nowhere here** — the feed is per-user × per-filter, so the key
space explodes and nothing is shared. A public read-only permalink for one message would be the ISR
candidate.

**Bundle & re-renders as features grow.** RSCs stay the default; `'use client'` only where interaction
starts. Route splitting is free in the App Router; heavy leaves go through `next/dynamic` (the date
picker costs 0 bytes until opened). `next/font` self-hosts both families — no external requests, no
CLS. Measure rather than guess: `@next/bundle-analyzer` in CI with a budget that fails the build.
For re-renders: filters live in the URL, not a context that re-renders the subtree; RHF keeps inputs
uncontrolled, so typing re-renders the counter, not the feed; the query key _is_ the memo key; and
virtualization caps mounted rows regardless of feed length. If a regression appears — Profiler,
"why did this render", push state down. Not `memo()` everywhere on principle.

**"The feed feels janky."** Record a scroll in the Performance panel and first decide _which_ jank:
**scripting**, **layout**, or **paint** — the fixes are unrelated. Scripting is almost always a
re-render storm (unstable `getItemKey`, or something above the list re-rendering per scroll event).
Layout means forced sync reflow — in a virtualized list, usually `measureElement` reading
`offsetHeight` in a loop, or an estimate so wrong the container height thrashes. Paint means too many
layers. Then the cheap checks: count the DOM rows (if 1200 are mounted, virtualization isn't on) and
sanity-check `overscan`. In _this_ codebase I'd look at `ESTIMATED_ROW_HEIGHT` first: if it drifts
from the measured median, `getTotalSize()` lies, the scrollbar rubber-bands, and it _feels_ janky
even at 60 fps.

---

## Next steps

All five were consciously time-boxed out of the challenge, not overlooked.

**1. CI/CD — GitHub Actions.** There is none today, and it's the first gap. One workflow, two jobs:
`verify` (`tsc` → `eslint` → `vitest` → production `next build`, plus a bundle-size budget that fails
the build on regression) and `deploy` (Vercel preview on PR, production on merge to `main`). Husky +
lint-staged already enforce this locally; CI is what makes it non-optional for everyone else.

**2. E2E with Playwright.** No suite is committed; the first one to write covers the flow that spans
every layer — log in → filter → post → edit → delete → `#fail` rollback.

**3. Screenshot / visual-regression tests.** The brief grades design precision, and design regressions
are exactly what unit tests can't see.

**4. Deeper unit coverage.** 24 tests today (login form, datetime, the global `next/navigation` mock).

**5. i18n — a real string dictionary.** `shared/config/copy.ts` exists but **nothing imports it**;
user-facing strings are still inline in components. The intended end state is that no component
contains a literal — every string is a typed key in the dictionary, which is then the seam
`next-intl` (or similar) plugs into. Skipped deliberately inside a challenge scoped.

---

**Run it:** see `README.md`. To demo the rollback, post a message containing `#fail` — it
deterministically returns `503`.
