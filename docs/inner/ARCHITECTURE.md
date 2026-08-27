# Implementation notes — DISPATCH

What this particular app does and why, and what the general rules look like once they hit real files.
The map — layers, what enforces them, where each pattern is written up — is
[`ARCHITECTURE.md`](../../ARCHITECTURE.md) at the root.

The app: a small team message board. Mock login, ≤240-character tagged messages, a feed filtered by
tag / author / date, cursor pagination, author-only inline edit and delete with optimistic UI and
rollback, and a virtualized list over 1200 seeded messages.

---

## Filtering

**The URL is the only source of truth** — the general form of this is in
[`data-layer.md`](../architecture/data-layer.md). What is specific here:

- Three filter dimensions: `tags` (multi), `user` (single), and a `from`/`to` date range.
- `serializeFilters` produces the query string _and_ the stable part of the query key, so a filter set
  and its cache entry cannot disagree by construction.
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
rules out caching it.

---

## Testing layout

**Unit tests live next to what they test**, in the same folder as the subject: `LoginForm.tsx`,
`LoginForm.test.tsx`, `LoginForm.testkit.tsx`. Moving a slice moves its tests with it, and a
component with no test beside it is visible at a glance instead of being a gap in a mirror tree three
directories away.

What stays in [`tests/`](../../tests) is the harness that belongs to no slice — `setup.ts`, the msw
server, the `next/navigation` and `server-only` mocks, `customRender` — reachable as `@tests/…`, and
deliberately **not** moved into `shared/`: a production layer holding `@testing-library` is exactly
what rule 6 exists to prevent. `tests/` is also where a Playwright `e2e/` suite would go, since that
one tests the app, not a slice.

A slice's whole testing surface is named by suffix — `.test.` (the suite), `.testkit.` (props +
driver + lifecycle), `.harness.` (the world it talks to), `.fixture.` (a stand-in component a suite
mounts). Those four are what the tooling uses to tell test-side code from production code now that
the directory no longer does. How a kit is built, and how it survives being wrapped by a widget you
do not own, is in [`testkit-component.md`](../testkit-component.md) — that is the approach in use
here. [`portkit/`](../portkit/README.md) documents a broader ports-and-fixtures variant and is kept
as reference material; it is **not** what this repo does.

---

## Public API decisions

**It is a decision, not a dump.** An export is a promise: whatever sits in a barrel, someone may
import, so its shape becomes yours to keep. The rule is **public API = what a consumer actually
imports, plus explicitly marked extension points** — and a `*Props` type is usually neither. A
consumer who needs one can derive it (`React.ComponentProps<typeof MessageCard>`), so exporting it is
convenience, never necessity; twelve were exported here and not one was imported outside its slice.
Two survived, tagged `@public` on their re-export because they are genuinely composition material:
`MessageCard` has an `actions` slot and exists to be wrapped, and `TagSelect` is a controlled field
that features embed in their own forms. The rest stay inside their module.

The same test applies to values, and it cuts both ways: `useCreateMessageMutation` is _not_ in the
`message-compose` barrel, because this slice owns both the mutation and the UI that fires it — the
only caller is `Composer`, one file away. `message-edit` and `message-delete` do export theirs, for
the opposite reason: their trigger lives in `widgets/message-card`, outside the slice.

`shared/` is exempt, structurally: it is segment-based, so `@/shared/ui/Button` _is_ the public API
and there is no barrel for an export to hide inside. Its primitives' Props (`ButtonProps extends
ButtonHTMLAttributes<…>`) are extension points by construction and stay exported, and so do their
variant unions (`AvatarVariant`, `ButtonVariant`) and `ErrorBoundaryFallbackProps` — those carry a
`@public` tag, because a Props type annotating an exported component is one knip infers as used while
a bare union is not. The one type that did _not_ survive there is `ToasterContextType`: the context
object itself is not exported, so the shape is unusable from outside, and a promise nobody can act on
is not an API.

---

## Why each rule exists

The list of seven is in [`lint-rules.md`](../architecture/lint-rules.md). This is what each one is doing here, and
what it caught.

**Rules 1–2 come from `eslint-plugin-import-fsd`; 3–7 are native `no-restricted-imports` patterns**,
no extra dependency. The plugin ranks `views` at `pages` level, which is what makes that rename free;
`server` is declared unknown-on-purpose via `ignores` — its `overrides` setting matches the _resolved_
path, not the `@/…` specifier, so it cannot do this job. Full reasoning in
[`layer-naming.md`](../architecture/layer-naming.md).

**Rule 6 is not about bundle size.** A stray import of `@testing-library` would only make the bundle
fat; an import of `tests/unit/test-utils/next-navigation.mock` ships a **stub in place of the real
`next/navigation`**, and no test would ever catch it, because the tests run on that stub by design.
Co-locating suites next to their subjects put those files one auto-import away from production code,
which is what turned this from hygiene into a gate. Both halves of the pattern list are needed:
package names catch the harm from any file, file names catch the harm from any package, and each
covers what the other structurally cannot — `knip --production --strict` does not see a `@tests/…`
path import at all.

**Rule 7 exists because the alternative is silence.** Per-resource query behaviour has to be
installed on the client instance, at the root that creates it — `setQueryDefaults(messageKeys.all,
…)`, with the policy owned by the entity
([`messageListQueryDefaults`](../../src/entities/message/api/queries.ts)) and the installing owned by
the root. That split is not a preference: `makeQueryClient` lives in `shared/`, and `shared`
importing an entity is a rule-1 error, because `shared` is a leaf and `entities/message` already
imports from it — the reverse edge would make a cycle structural. So the wiring has to live in
`app/`, and it did: in `providers.tsx` only. The RSC prefetch and the test renderer each called
`makeQueryClient` directly and got a **different configuration, without failing** — three roots, one
configured.

What that costs is worth being precise about, because it is not stale data: `dehydrate()` ships data,
key and `dataUpdatedAt`, and post-hydration freshness is computed by the browser client, so
`staleTime`/`gcTime` never needed to match. What diverges is behaviour — a per-resource `retry`,
`queryFn`, `select` or `throwOnError` would apply in the browser and quietly not in the RSC — and,
today, what the tests exercise: `placeholderData: keepPreviousData` is the app's one per-resource
default, and it is exactly what a "changing a filter swaps the list in place" test asserts. One
factory fixes the drift; the lint rule is what keeps the fourth root from repeating it.

**Tests are deliberately exempt from rules 1–6** — including rule 6, which is what lets a test import
`vitest` at all: `vi.mock('@/features/auth/api/login.action')` needs to reach inside a slice, and a
test that cannot mock internals just tests less. That exemption used to be free — tests lived outside
`src/`, which the rules never targeted. Now it is a block of its own, matching the four test-side
suffixes, and it has to be the _last_ block in the config: `no-restricted-imports` does not merge, so
position is what makes it win. Rule 7 is the one they are **not** exempt from — reaching inside a
slice makes a test sharper, quietly configuring its own client makes it test something the app never
runs — and it is also the only rule that reaches into `tests/**`, since the harness there sits
outside `src/` entirely.

**`@public`, in numbers.** Six exports carry the tag: `MessageCardProps` and `TagSelectProps`
(composition material), `AvatarVariant`, `ButtonVariant` and `ErrorBoundaryFallbackProps`
(`shared/ui` extension points), and `db.ts`'s `reseedDb`, which exists for route-handler tests not
yet written. Deciding the policy before running the tool was the point. The barrels were weeded by
hand against it first — 13 exports dropped, 2 kept and tagged — and knip's first pass then turned up
13 _more_ unimported exports outside any barrel (a session verifier, a demo password, four in-file
types in `shared/ui`, the test kits' own helpers) plus a duplicate render helper in `tests/`. Without
a rule to sort findings like those by, the tempting fix is a blanket ignore, and that costs you the
signal.

**The second knip step has already paid for itself.** `--production --strict` walks the graph from
production entry points only and reports any devDependency that surfaces there, by whatever name, so
it needs no list to maintain. `--strict` is the operative flag — plain `--production` reports
_nothing_ for a `vitest` import in a production file, while `--strict` names the file and line. It
found `@testing-library/user-event` sitting in `dependencies`, used by nothing but tests.

---

## Steiger on this tree

[Steiger](https://github.com/feature-sliced/steiger) is advisory here, not a gate, and this tree is
why. It recognises only canonical layer names, so it does not traverse `views/` or `server/` at all.
The practical effect is that it reports `widgets/message-card` and `features/message-compose` as
"slice has no references" when their only consumer is `views/feed`. Useful as a second opinion before
a big refactor; not something to block a merge on.

---

## Conventions

- **Validation vs. toasts, split by who is at fault.** Field-level (empty, >240, bad email) → inline
  `role="alert"` wired to the input via `aria-describedby`. Request-level (`503`, network, bad
  credentials) → toast, because there is no field to blame.
- **Disable for no-ops, never for invalid.** Composer `POST` stays **enabled** when empty — empty is
  _invalid_, the user needs telling why, and a `disabled` button is out of the tab order and explains
  nothing. Editor `SAVE` **is** disabled when the text equals the original — unchanged is _valid but
  pointless_. (⌘+Enter bypasses a disabled button, so the same check also guards the submit handler.)
- **Optimistic UI may lie about timing, never about outcome.** A message your filters would hide does
  not silently vanish: it is run through `matchesFilters` first, and if it would not show we do not
  fake it into the list — we toast _"Posted — hidden by current filters"_.
- **Accessibility outranks pixel fidelity.** The spec sets `outline: none`; we restore
  `:focus-visible`. The char counter is `sr-only` on mobile (the spec omits it) rather than `hidden`,
  so the live region still announces.
- **One schema, two consumers.** The zod schema that validates the composer form is the same one the
  route handler validates against. Two definitions drift; one cannot.
- **A test asserts the accessibility contract, not the rendered text.** A field error is checked as
  "this input is programmatically invalid _and_ its accessible description carries the message", not
  as `getByText(message)` — which would pass on a stray `<div>` anywhere on screen and is not what a
  screen-reader user gets. The same instinct applies to queries: prefer roles and labels over test
  ids, and reach for a test id only when neither exists.

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

---

## Trade-offs

| Decision                                       | Why                                                                                                                                        | Accepted cost                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `history.pushState`, not `router.push`         | No RSC round-trip per interaction                                                                                                          | Server never learns the URL changed → SSR data must be keyed carefully                                                                                   |
| `HydrationBoundary`, not `initialData`         | Data travels with its query key; wrong-cache-entry bugs become impossible                                                                  | A per-request `QueryClient` on the server                                                                                                                |
| Prefetch not awaited (pending query streamed)  | Shell paints in ~100 ms instead of waiting on the data                                                                                     | Must opt `shouldDehydrateQuery` into pending queries                                                                                                     |
| Virtualized, but plain flow until mount        | During SSR the virtualizer has no viewport rect → zero rows, then overlapping ones                                                         | One extra pre-paint render on mount                                                                                                                      |
| Cursor pagination, not offset                  | Offset breaks under the app's own optimistic create/delete                                                                                 | No jump-to-page, and the cursor is opaque by design                                                                                                      |
| Invalidate the key prefix on every mutation    | Other cached filter combinations still hold the pre-mutation list and would serve it from cache                                            | Almost none — `invalidateQueries` only _marks_ stale (`refetchType: 'active'`), so only the one mounted query refetches                                  |
| `index.ts` per slice, deep imports lint-banned | A slice's internals stop being API: moving a component between segments touches one file, not 60 call sites                                | One more file per slice, and a barrel is a place unused exports can hide — weeded by hand once (15 exports nobody imported), kept weeded by `knip` in CI |
| Architecture rules in ESLint, not Steiger      | Steiger doesn't recognise `views`/`server`, so it can't see most of this tree; ESLint fails on the offending line, in the IDE, as you type | Layer direction and public-API checks come from two different mechanisms instead of one tool                                                             |
| Tests co-located, harness left in `tests/`     | A slice carries its own tests when it moves, and a missing test is visible next to the file instead of absent from a mirror tree           | Test files now sit inside `src/`, so the lint rules need explicit exemptions and rule 6 becomes load-bearing rather than theoretical                     |
| HTTP + TanStack Query, not GraphQL             | One client, one resource — nothing to over-fetch, and status codes _are_ our UI states                                                     | Revisit if the card grows reactions or threads (OpenAPI codegen first)                                                                                   |
| In-memory seeded store, no database            | The brief is about the frontend; a deterministic seed makes the feed reviewable                                                            | The store resets on restart                                                                                                                              |
| `#fail` as a deterministic failure trigger     | A reviewer can see the rollback path on demand instead of waiting for a random failure                                                     | One magic string in the mock backend                                                                                                                     |

---

## When the feed feels slow

The generic playbook: record the interaction in the Performance panel and first decide _which_ jank
it is, because the three fixes are unrelated. **Scripting** is almost always a re-render storm — an
unstable list key, or something above the list re-rendering on every scroll event. **Layout** means
forced synchronous reflow, usually a measurement reading `offsetHeight` in a loop or a size estimate
wrong enough that the container height thrashes. **Paint** means too many layers.

Then the cheap checks, in order: count the mounted DOM rows (if all 1200 are there, virtualization is
not actually on), sanity-check `overscan`, and compare the row-height estimate against the measured
median.

In _this_ codebase the first thing to look at is `ESTIMATED_ROW_HEIGHT`. If it has drifted from the
measured median, `getTotalSize()` lies, the scrollbar rubber-bands, and the list feels janky at a
perfectly good 60 fps.

Whether the bundle grew is a different question from what grew: the budget in
[`.size-limit.js`](../../.size-limit.js) answers the first, `pnpm analyze` the second — see
[`rendering.md`](../architecture/rendering.md).

---

## The brief's bonus questions

**Rendering strategy.** `/auth/login` → **static** (no per-request data; the form is a client
island). `/` feed → **SSR, dynamic, streamed**: it depends on the session cookie _and_
`searchParams`, and `permissions` are per-viewer, so it cannot be cached. `/api/**` → route handlers,
uncached (mutations must be read-your-writes). **ISR fits nowhere here** — the feed is per-user ×
per-filter, so the key space explodes and nothing is shared. A public read-only permalink for one
message would be the ISR candidate.

**Bundle & re-renders as features grow.** The general discipline is in
[`rendering.md`](../architecture/rendering.md). Applied here: the date picker costs 0 bytes until opened, filters
live in the URL rather than a context that re-renders the subtree, RHF keeps the composer
uncontrolled so typing re-renders the counter and not the feed, and virtualization caps mounted rows
regardless of feed length.

**"The feed feels janky."** See the section above.

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
