# ARCHITECTURE

---

## Structure

Feature-Sliced Design. Dependencies point one way:
`app → views → widgets → features → entities → shared`.

```
src/
  app/       Next surface + composition root: RSC pages, route handlers,
             proxy.ts, providers, the query-client factory
  views/     page composition (feed)
  widgets/   composition blocks (header, message-card)
  features/  capabilities (auth, feed-filters, message-compose/edit/delete)
  entities/  domain + its "dumb" UI (message, session)
  shared/    primitives with no domain knowledge (ui, lib, api, config)
  server/    "the backend": in-memory db, services, auth, latency simulation
tests/       the test harness no slice owns; future e2e
```

Every slice is `<layer>/<slice>/{ui,model,api,lib}/` plus an `index.ts`, and that `index.ts` is the
**only** way in. Outside the slice you write `@/entities/message`, never
`@/entities/message/ui/MessageCard`; inside it you use relative paths. That is what makes a slice's
internals free to move — the segment layout above is an implementation detail, not an API.

**Unit tests live next to what they test**, in the same folder as the subject:
`LoginForm.tsx`, `LoginForm.test.tsx`, `LoginForm.testkit.tsx`. Moving a slice moves its tests with
it, and a component with no test beside it is visible at a glance instead of being a gap in a mirror
tree three directories away. What stays in [`tests/`](tests) is the harness that belongs to no slice —
`setup.ts`, the msw server, the `next/navigation` and `server-only` mocks, `customRender` — reachable
as `@tests/…`, and deliberately not moved into `shared/`: a production layer holding
`@testing-library` is exactly what rule 6 below exists to prevent. `tests/` is also where a Playwright
`e2e/` suite would go, since that one tests the app, not a slice.

**What goes into that `index.ts` is a decision, not a dump.** An export is a promise: whatever sits
in a barrel, someone may import, so its shape becomes yours to keep. The rule is **public API = what
a consumer actually imports, plus explicitly marked extension points** — and a `*Props` type is
usually neither. A consumer who needs one can derive it (`React.ComponentProps<typeof MessageCard>`),
so exporting it is convenience, never necessity; twelve were exported here and not one was imported
outside its slice. Two survived, tagged `@public` on their re-export because they are genuinely
composition material: `MessageCard` has an `actions` slot and exists to be wrapped, and `TagSelect`
is a controlled field that features embed in their own forms. The rest stay inside their module.

The same test applies to values, and it cuts both ways: `useCreateMessageMutation` is _not_ in the
`message-compose` barrel, because this slice owns both the mutation and the UI that fires it — the
only caller is `Composer`, one file away. `message-edit` and `message-delete` do export theirs, for
the opposite reason: their trigger lives in `widgets/message-card`, outside the slice.

`shared/` is exempt, structurally: it is segment-based, so `@/shared/ui/Button` _is_ the public API
and there is no barrel for an export to hide inside. Its primitives' Props (`ButtonProps extends
ButtonHTMLAttributes<…>`) are extension points by construction and stay exported, and so do their
variant unions (`AvatarVariant`, `ButtonVariant`) and `ErrorBoundaryFallbackProps` — those carry a
`@public` tag, because a Props type annotating an exported component is one knip infers as used while a
bare union is not. The one type that did _not_ survive there is `ToasterContextType`: the context object
itself is not exported, so the shape is unusable from outside, and a promise nobody can act on is not an
API.

Two names need explaining because they are not stock FSD:

- **`views/` is FSD's `pages` layer, and the name is a deliberate deviation.** That the layer must be
  renamed at all is [official FSD guidance for Next](https://feature-sliced.design/docs/guides/tech/with-nextjs)
  — `pages/` collides with Next's own routing convention. But the name that guidance gives is `_pages`
  (with `_app` alongside it), not `views`, so this is a departure from the letter of it, not compliance.

  The reason is lint coverage, and it is checkable:
  [`eslint-plugin-import-fsd`](https://www.npmjs.com/package/eslint-plugin-import-fsd) ships a layer
  table (`dist/cjs/utils/layers.js`) in which `view`/`views`/`screen`/`screens`/`layout`/`layouts` are
  aliases at **`pages` rank** — flagged legacy, which is what the `no-deprecated-layers` ignore in
  [`eslint.config.mjs`](eslint.config.mjs) is for. `_pages` is in no table at all: it would be an
  _unknown_ layer, so it would need a `no-unknown-layers` ignore, and after that `no-denied-layers`
  silently stops checking every import in the layer — precisely what already happens to `server/`. So
  the trade is: the official name and no layer-direction checking for the whole `pages` layer, or a
  deprecated alias with full checking. We took the checking. `app/` keeps its plain name for a different
  reason — Next's `app/` and FSD's app layer are the same thing here, composition root included, so they
  coincide rather than collide.

- **`server/` is a 7th layer that sits outside FSD entirely.** It is the mocked backend, and FSD has
  nothing to say about backends. Its rule is explicit rather than inferred: **only `app/**` (route
  handlers, RSCs) and `*.action.ts` server actions may import `@/server/**`.** `import 'server-only'`
  turns a leak into a compile error; the lint rule below turns it into a lint error one step earlier.

The boundary that earns its keep is **domain vs. reusable**: `shared/ui/Button` knows nothing about
messages; `MessageCard` knows nothing about filters or who is logged in.

**One zod schema** validates the composer form _and_ the route handler. One definition, no drift —
that schema is the artifact you'd hand a backend team.

---

## Rules the linter checks

Prose does not hold an architecture. These seven are lint errors in
[`eslint.config.mjs`](eslint.config.mjs), run by husky/lint-staged locally and by
[CI](.github/workflows/verify.yml) on every PR:

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
   `*.test.*` or `*.testkit.*` file. The direction is one-way and only one way.
7. **Query clients come from one factory.** `createAppQueryClient` in
   [`app/query-client.ts`](src/app/query-client.ts) — nothing else may import
   `makeQueryClient`, the file itself excepted.

Rules 1–2 come from [`eslint-plugin-import-fsd`](https://www.npmjs.com/package/eslint-plugin-import-fsd);
3–7 are native `no-restricted-imports` patterns, no extra dependency. The plugin ranks `views` at
`pages` level, which is what makes that rename free (above); `server` is declared unknown-on-purpose via
`ignores` — its `overrides` setting matches the _resolved_ path, not the `@/…` specifier, so it cannot
do this job.

**Rule 6 is not about bundle size.** A stray import of `@testing-library` would only make the bundle
fat; an import of `tests/unit/test-utils/next-navigation.mock` ships a **stub in place of the real
`next/navigation`**, and no test would ever catch it, because the tests run on that stub by design.
Co-locating suites next to their subjects (above) put those files one auto-import away from production
code, which is what turned this from hygiene into a gate. Both halves of the pattern list are needed:
package names catch the harm from any file, file names catch the harm from any package, and each covers
what the other structurally cannot — `knip --production --strict` (below) does not see a `@tests/…`
path import at all.

**Rule 7 exists because the alternative is silence.** Per-resource query behaviour has to be installed
on the client instance, at the root that creates it — `setQueryDefaults(messageKeys.all, …)`, with the
policy owned by the entity ([`messageListQueryDefaults`](src/entities/message/api/queries.ts)) and the
installing owned by the root. That split is not a preference: `makeQueryClient` lives in `shared/`, and
`shared` importing an entity is a rule-1 error, because `shared` is a leaf and `entities/message` already
imports from it — the reverse edge would make a cycle structural. So the wiring has to live in `app/`,
and it did: in `providers.tsx` only. The RSC prefetch and the test renderer each called
`makeQueryClient` directly and got a **different configuration, without failing** — three roots, one
configured. What that costs is worth being precise about, because it is not stale data: `dehydrate()`
ships data, key and `dataUpdatedAt`, and post-hydration freshness is computed by the browser client, so
`staleTime`/`gcTime` never needed to match. What diverges is behaviour — a per-resource `retry`,
`queryFn`, `select` or `throwOnError` would apply in the browser and quietly not in the RSC — and, today,
what the tests exercise: `placeholderData: keepPreviousData` is the app's one per-resource default, and it
is exactly what a "changing a filter swaps the list in place" test asserts. One factory fixes the drift;
the lint rule is what keeps the fourth root from repeating it.

Tests are deliberately exempt from rules 1–6 — including rule 6, which is what lets a test import
`vitest` at all: `vi.mock('@/features/auth/api/login.action')` needs to reach inside a slice, and a test
that can't mock internals just tests less. That exemption used to be
free — tests lived outside `src/`, which the rules never targeted. Now it is a block of its own,
matching `src/**/*.{test,spec}.*` and `src/**/*.testkit.*`, and it has to be the _last_ block in the
config: `no-restricted-imports` does not merge, so position is what makes it win. Rule 7 is the one they
are **not** exempt from — reaching inside a slice makes a test sharper, quietly configuring its own
client makes it test something the app never runs — and it is also the only rule that reaches into
`tests/**`, since the harness there sits outside `src/` entirely.

**The eighth rule is a different tool, because ESLint cannot hold it.** Rule 3 above enforces that you
come in _through_ `index.ts`, never what is _in_ it — and ESLint reads one file at a time, so to a
barrel a re-export always looks used. Whether anything on the other side imports it is a module-graph
question. [`knip`](https://knip.dev) answers it and runs in [CI](.github/workflows/verify.yml) right
after `eslint`; [`knip.jsonc`](knip.jsonc) declares the entry points it cannot infer — three patterns,
all of them git hooks — and nothing else. No ignores.

**`@public` is the whole vocabulary**: an export tagged that way may stay unimported. Six are —
`MessageCardProps` and `TagSelectProps` (composition material), `AvatarVariant`, `ButtonVariant` and
`ErrorBoundaryFallbackProps` (`shared/ui` extension points), and `db.ts`'s `reseedDb`, which exists for
route-handler tests not yet written. Deciding the policy before running the tool was the point. The
barrels were weeded by hand against it first — 13 exports dropped, 2 kept and tagged — and knip's first
pass then turned up 13 _more_ unimported exports outside any barrel (a session verifier, a demo
password, four in-file types in `shared/ui`, the test kits' own helpers) plus a duplicate render helper
in `tests/`. Without a rule to sort findings like those by, the tempting fix is a blanket ignore, and
that costs you the signal.

**A second knip step — `--production --strict` — is the structural half of rule 6.** It walks the graph
from production entry points only and reports any devDependency that surfaces there, by whatever name,
so it needs no list to maintain. Two things about it are measured rather than assumed: `--strict` is the
operative flag (plain `--production` reports _nothing_ for a `vitest` import in a production file, while
`--strict` names the file and line), and it says nothing at all about a production file importing
`@tests/…` by path, because in production mode `tests/**` is outside the project — that case belongs to
the ESLint half alone. It has already paid for itself once: `@testing-library/user-event` was sitting in
`dependencies`, used by nothing but tests.

**[Steiger](https://github.com/feature-sliced/steiger) is an advisory audit, not a gate.** Run
`pnpm dlx steiger ./src` before a big refactor to see the debt map — but it recognises only canonical
layer names, so it does not traverse `views/` or `server/` at all. The practical effect is that it
reports `widgets/message-card` and `features/message-compose` as "slice has no references" when their
only consumer is `views/feed`. Useful as a second opinion; not something to block a merge on.

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
its query key, a filter change simply lands on a different key and refetches.

**Optimistic mutations.** `onMutate` cancels in-flight queries (else a landing refetch clobbers the
write), snapshots the cache, then writes; `onError` restores the snapshot wholesale. The **client
generates the message id**, which buys two things: the server echoes it back, so `onSuccess` swaps in
place — same id → same virtualizer key → **no remount, no scroll jump** — and the POST is idempotent,
so a retry can't double-post. `retry: 0` on mutations: an auto-retry would fire after the rollback and
fight it.

**Failures are caught next to the list, not at the route.** `useSuspenseInfiniteQuery` defaults to
`throwOnError: true`, so a failed fetch never sets `query.isError` — it throws. Without a boundary
around the list, it escapes all the way to `app/(main)/error.tsx` and replaces the whole page,
composer and filters included. A local `<ErrorBoundary>` (`shared/ui`, ~40 lines — not worth a
dependency) wired to `useQueryErrorResetBoundary` keeps the page standing and makes RETRY refetch in
place. Changing filters clears the error on its own: a new filter set is a new request, so the old
failure no longer applies.

**Query defaults are per-resource, not global.** `makeQueryClient` sets only what is genuinely
app-wide (`staleTime`, `retry`, dehydration). Anything feed-specific is registered with
`setQueryDefaults(messageKeys.all, …)` at the composition root, with the policy itself owned by the
entity ([`messageListQueryDefaults`](src/entities/message/api/queries.ts)). `placeholderData:
keepPreviousData` used to be a global default, which meant it also governed the user list and every
query written since. Worth knowing: `UseSuspenseInfiniteQueryOptions` _omits_ `placeholderData`, so a
query default is the only place it type-checks — it works at runtime, but on a library inconsistency
rather than a contract. If that ever closes, the supported replacement is `useTransition` around the
filter write. The full case — mechanics, failure modes, and the four correct ways to use the option —
is in [`TSQueryPrevDataGuide.md`](TSQueryPrevDataGuide.md).

---

## UI/UX decisions

- **One range picker, not two date inputs.** A calendar makes the invalid state _unrepresentable_ — you cannot pick an end before a start. Two text fields would mean parsing, locales, "to < from" validation.
- **Two things load lazily, for different reasons.** `DateRangePicker` is **code-split** (`next/dynamic`) — it drags in `react-day-picker`, which nobody needs until they open it. `UserSelect` isn't code-split but **owns its own query**: the user list isn't part of the message contract, so the feed never waits on it.
- **`clamp()` for the login headline**, anchored on the two sizes the spec gives (52px @390, 88px @1440). A breakpoint would jump; this scales.
- **Validation vs. toasts, split by who's at fault.** Field-level (empty, >240, bad email) → inline `role="alert"` wired to the input via `aria-describedby`. Request-level (`503`, network, bad credentials) → toast, because there's no field to blame.
- **Disable for no-ops, never for invalid.** Composer `POST` stays **enabled** when empty — empty is _invalid_, the user needs telling why, and a `disabled` button is out of the tab order and explains nothing. Editor `SAVE` **is** disabled when the text equals the original — unchanged is _valid but pointless_. (⌘+Enter bypasses a disabled button, so the same check also guards the submit handler.)
- **A message your filters would hide doesn't silently vanish.** It's run through `matchesFilters` first; if it wouldn't show, we don't fake it into the list — we toast _"Posted — hidden by current filters"_. Optimistic UI may be optimistic about timing; it must not lie about where the data went.
- **Accessibility over pixel fidelity, deliberately.** The spec sets `outline: none`; we restore `:focus-visible`. The char counter is `sr-only` on mobile (the spec omits it) rather than `hidden`, so the live region still announces.

---

## Trade-offs

| Decision                                       | Why                                                                                                                                                          | Accepted cost                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `history.pushState`, not `router.push`         | No RSC round-trip per chip tap                                                                                                                               | Server never learns filters changed → SSR data must be keyed carefully                                                                                   |
| `HydrationBoundary`, not `initialData`         | Data travels with its query key; wrong-cache-entry bugs become impossible                                                                                    | A per-request `QueryClient` on the server                                                                                                                |
| Prefetch not awaited (pending query streamed)  | Shell paints in ~100 ms instead of waiting on the feed                                                                                                       | Must opt `shouldDehydrateQuery` into pending queries                                                                                                     |
| Virtualized, but plain flow until mount        | During SSR the virtualizer has no viewport rect → zero rows, then overlapping ones                                                                           | One extra pre-paint render on mount                                                                                                                      |
| Cursor + LOAD MORE button                      | Offset breaks under this app's own optimistic create/delete                                                                                                  | No auto-load convenience                                                                                                                                 |
| HTTP + TanStack Query, not GraphQL             | One client, one resource — nothing to over-fetch; status codes _are_ our UI states                                                                           | Revisit if the card grows reactions/threads (OpenAPI codegen first)                                                                                      |
| Invalidate `messageKeys.all` on every mutation | Other cached filter combinations still hold the pre-mutation list; without this, a message deleted under `?tags=PRODUCT` reappears when you clear the filter | Almost none — `invalidateQueries` only _marks_ stale (`refetchType: 'active'`), so only the one mounted query refetches                                  |
| `index.ts` per slice, deep imports lint-banned | A slice's internals stop being API: moving `MessageCard` between segments touches one file, not 60 call sites                                                | One more file per slice, and a barrel is a place unused exports can hide — weeded by hand once (15 exports nobody imported), kept weeded by `knip` in CI |
| Architecture rules in ESLint, not Steiger      | Steiger doesn't recognise `views`/`server`, so it can't see most of this tree; ESLint fails on the offending line, in the IDE, as you type                   | Layer direction and public-API checks come from two different mechanisms instead of one tool                                                             |
| Tests co-located, harness left in `tests/`     | A slice carries its own tests when it moves, and a missing test is visible next to the file instead of absent from a mirror tree                             | Test files now sit inside `src/`, so the lint rules need explicit exemptions and rule 6 becomes load-bearing rather than theoretical                     |

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
CLS. Measure rather than guess: the budget in [`.size-limit.js`](.size-limit.js) now fails the build on
regression, which answers _did it grow_; `@next/bundle-analyzer` is still unwired and answers the other
half, _what grew_ — worth adding the day a budget first trips.
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

All were consciously time-boxed out of the challenge, not overlooked.

**1. CD — deployment.** [`.github/workflows/verify.yml`](.github/workflows/verify.yml) now runs
`tsc` → `eslint` (the architecture gate) → `knip` (the dead-code half of it) →
`knip --production --strict` (the production graph) → `prettier` → `vitest` → production `next build` →
`size-limit` on every PR. The one thing still missing is a `deploy` job: Vercel preview on PR,
production on merge to `master`.

The bundle budget is now real: [`.size-limit.js`](.size-limit.js) measures gzipped
`.next/static/chunks/**` against **415 kB of JS and 7.5 kB of CSS** (measured 377 kB / 6.4 kB, seeded
with ~10% headroom) and fails the build when a budget is exceeded. Whole-output globs rather than
per-route First Load JS, because Next 16's Turbopack emits flat content-hashed chunks with no per-route
directory to glob — and total shipped JS is the number a careless dependency moves anyway, which is what
the gate is for. Raising a budget is fine; doing it in a diff, with a reason, is the point.

**2. E2E with Playwright.** No suite is committed; the first one to write covers the flow that spans
every layer — log in → filter → post → edit → delete → `#fail` rollback.

**3. Screenshot / visual-regression tests.** The brief grades design precision, and design regressions
are exactly what unit tests can't see.

**4. Deeper unit coverage.** 26 tests today (login form, datetime, the global `next/navigation` mock,
and the feed's error boundary). Next up: the optimistic hooks' rollback, and `useFeedFilters` ↔ URL
round-tripping.

**5. i18n — a real string dictionary.** User-facing strings are inline in components. The intended end
state is that no component contains a literal — every string is a typed key in a dictionary, which is
then the seam `next-intl` (or similar) plugs into. There _was_ a `shared/config/copy.ts` holding a
half-written dictionary that nothing imported and that had already drifted from the real copy; it has
been deleted. An unused seam is not a head start, it's a second source of truth that lies. The work
starts when someone does the extraction for real.

**6. A `FormField` wrapper.** Label, error message, `aria-describedby` wiring, and `sr-only` handling
are currently duplicated per-input (`Textarea`, and any future `Input`/`Select`). The fix is a
`FormField` component that owns that shared logic and composes a `shared/ui` primitive inside it,
so each primitive (`Textarea`, `Input`, …) stays a plain, presentational field with no label/error
concerns of its own.

**7. Run the commit-message linter's own tests.** `knip` surfaced this one:
`.husky/lint-commit-message/{formatter,validators}.test.mjs` are 10 passing `node:test` cases that
nothing executes — Vitest's `include` is `tests/unit/**`, and no script or CI step invokes
`node --test`. They are declared as entry points in [`knip.jsonc`](knip.jsonc) so the tool doesn't call
a test file dead, which is true but not the same as running it. The fix is a `test:hooks` script plus a
step in `verify.yml`; the reason it isn't done here is that a hook linter with unrun tests deserves the
same decision as the hook linter itself, and that is a bigger conversation than this challenge.

---

**Run it:** see `README.md`. To demo the rollback, post a message containing `#fail` — it
deterministically returns `503`.
