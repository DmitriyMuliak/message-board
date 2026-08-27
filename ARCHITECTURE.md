# ARCHITECTURE

This document is the **transferable** half: how the codebase is organised, what holds that
organisation in place, and the data, rendering and testing patterns a developer would carry into
another project. Nothing here depends on the app being a message board.

What this particular app does and why — the domain, its filters, its pagination format, its UI
decisions, and what is still on the list — lives in
[`docs/inner/ARCHITECTURE.md`](docs/inner/ARCHITECTURE.md).

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

Deciding whether a given thing is a feature or a widget, and who may import whom, is the one part of
FSD a linter cannot settle for you. That reasoning is in
[`docs/fsd-in-practice.md`](docs/fsd-in-practice.md).

**Unit tests live next to what they test**, in the same folder as the subject:
`LoginForm.tsx`, `LoginForm.test.tsx`, `LoginForm.testkit.tsx`. Moving a slice moves its tests with
it, and a component with no test beside it is visible at a glance instead of being a gap in a mirror
tree three directories away. What stays in [`tests/`](tests) is the harness that belongs to no slice —
`setup.ts`, the msw server, the `next/navigation` and `server-only` mocks, `customRender` — reachable
as `@tests/…`, and deliberately not moved into `shared/`: a production layer holding
`@testing-library` is exactly what rule 6 below exists to prevent. `tests/` is also where a Playwright
`e2e/` suite would go, since that one tests the app, not a slice.

A slice's whole testing surface is named by suffix — `.test.` (the suite), `.testkit.` (props +
driver + lifecycle), `.harness.` (the world it talks to), `.fixture.` (a stand-in component a suite
mounts). Those four are what the tooling uses to tell test-side code from production code now that the
directory no longer does. How a kit is built, and how it survives being wrapped by a widget you do not
own, is in [`docs/testkit-component.md`](docs/testkit-component.md).

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
   `*.test.*`, `*.testkit.*`, `*.harness.*` or `*.fixture.*` file. The direction is one-way and only
   one way.
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
matching the four test-side suffixes, and it has to be the _last_ block in the config:
`no-restricted-imports` does not merge, so position is what makes it win. Rule 7 is the one they
are **not** exempt from — reaching inside a slice makes a test sharper, quietly configuring its own
client makes it test something the app never runs — and it is also the only rule that reaches into
`tests/**`, since the harness there sits outside `src/` entirely.

**The eighth rule is a different tool, because ESLint cannot hold it.** Rule 3 above enforces that you
come in _through_ `index.ts`, never what is _in_ it — and ESLint reads one file at a time, so to a
barrel a re-export always looks used. Whether anything on the other side imports it is a module-graph
question. [`knip`](https://knip.dev) answers it and runs in [CI](.github/workflows/verify.yml) right
after `eslint`. The full account of what it checks and why it is there is in
[`docs/knip-in-ci.md`](docs/knip-in-ci.md).

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

## The data layer

**View state lives in the URL, not in React.** Components read `useSearchParams()`; interactions write
`window.history.pushState`. Shareable and bookmarkable come free, because there was never a second
copy to keep in sync. `pushState` rather than `router.push` is the deliberate part: it changes the URL
without re-running the RSC, so a filter chip does not cost a server round-trip. The cost is stated in
Trade-offs — the server never learns the URL changed, so anything server-rendered has to be keyed
carefully.

**Server data is TanStack Query, hydrated _with its key_.** The RSC prefetches into a per-request
`QueryClient` and ships it via `dehydrate()` + `<HydrationBoundary>`, never `initialData`. Because
dehydrated data carries its query key, a client that asks for a different key simply misses and
fetches — the entire class of "wrong data under the right key" bugs is unrepresentable.

**The prefetch is not awaited.** `shouldDehydrateQuery` is opened up to `pending` queries, so the
server dehydrates the in-flight promise itself: the shell streams immediately and the data slot fills
when it resolves. Measured on this app under 1.2 s of simulated latency: ~100 ms to first paint
instead of ~1.4 s.

**Optimistic mutations follow one shape.** `onMutate` cancels in-flight queries for the key (otherwise
a landing refetch clobbers the write), snapshots the cache, then writes. `onError` restores the
snapshot wholesale rather than trying to undo field by field. `retry: 0` on mutations, because an
auto-retry fires after the rollback and fights it.

**The client generates the entity id.** The server echoes it back, so `onSuccess` swaps the optimistic
row in place — same id, same list key, no remount and no scroll jump — and the POST becomes
idempotent, so a retry cannot double-create. This is worth doing even when the optimistic UI is not
virtualized; it is what makes reconciliation a swap instead of a diff.

**Invalidate broadly, refetch narrowly.** A mutation invalidates the whole key prefix, not just the
key currently on screen: every other cached filter combination still holds the pre-mutation list and
would serve it from cache for `staleTime`. That is nearly free — `invalidateQueries` only _marks_
stale, and with the default `refetchType: 'active'` only the mounted query actually refetches.

**Failures are caught next to the data, not at the route.** `useSuspenseQuery` and
`useSuspenseInfiniteQuery` default to `throwOnError: true`, so a failed fetch never sets
`query.isError` — it throws. Without a boundary around the consuming component it escapes to the
route-level `error.tsx` and replaces the whole page. A local `<ErrorBoundary>` (`shared/ui`, ~40 lines
— not worth a dependency) wired to `useQueryErrorResetBoundary` keeps the rest of the page standing
and makes a retry refetch in place. Give it `resetKeys` so a changed input clears a stale error on its
own: a new request means the old failure no longer applies.

**Query defaults are per-resource, not global.** `makeQueryClient` sets only what is genuinely
app-wide (`staleTime`, `retry`, dehydration). Anything resource-specific is registered with
`setQueryDefaults(<keyPrefix>, …)` at the composition root, with the policy owned by the entity the key
belongs to. `placeholderData: keepPreviousData` used to be a global default here, which meant it also
governed an unrelated dropdown's query and every query written since. Worth knowing:
`UseSuspenseInfiniteQueryOptions` _omits_ `placeholderData`, so a query default is the only place it
type-checks — it works at runtime, but on a library inconsistency rather than a contract. The full
case — mechanics, failure modes, and the four correct ways to use the option — is in
[`docs/TSQueryPrevDataGuide.md`](docs/TSQueryPrevDataGuide.md).

**Cursor pagination, not offset.** Offset breaks under an app's own optimistic writes: insert a row at
the top while the reader is on page 1 and page 2 repeats a row; delete one and page 2 skips one. A
keyset cursor is stable under both. Make it opaque (base64 of the sort key plus a tiebreaker) so the
sort key can change later without breaking a client that decided to parse it.

---

## Rendering

**RSC is the default; `'use client'` starts where interaction starts.** Route-level splitting is free
in the App Router. Heavy leaves go through `next/dynamic` — a component that pulls in a large library
nobody needs until they open it should cost zero bytes until they do. `next/font` self-hosts, so no
external request and no CLS.

**Pick the strategy per route, from what the route depends on.** A page with no per-request data is
static even if it contains a client island. A page that depends on the session cookie _and_
`searchParams`, and whose payload differs per viewer, is dynamic and streamed — it cannot be cached.
Route handlers behind mutations are uncached, because those have to be read-your-writes. ISR needs a
key space small enough that cache entries are actually shared; per-user × per-filter is not that, and
recognising when ISR does _not_ fit is the useful half of knowing about it.

**Re-render discipline is structural, not `memo()` everywhere.** View state in the URL rather than a
context avoids re-rendering a subtree on every change. React Hook Form keeps inputs uncontrolled, so
typing re-renders the character counter, not the list beside it. The query key _is_ the memo key.
Virtualization caps mounted rows regardless of collection length. When a regression does appear, reach
for the Profiler and "why did this render" before reaching for `memo`.

**Virtualize after mount, not during SSR.** A virtualizer has no viewport rect on the server, so it
renders zero rows and then a burst of overlapping ones on hydration. Render plain flow until mounted
and switch after — one extra pre-paint render, in exchange for correct SSR output.

---

## Conventions

- **Validation and toasts are split by who is at fault.** Field-level problems (empty, too long,
  malformed) render inline with `role="alert"`, wired to the input via `aria-describedby`.
  Request-level problems (`503`, network, bad credentials) go to a toast, because there is no field to
  blame.
- **Disable for no-ops, never for invalid.** A submit stays **enabled** when the form is empty — empty
  is _invalid_, the user needs telling why, and a `disabled` button is out of the tab order and
  explains nothing. A save **is** disabled when nothing changed — that is _valid but pointless_.
  Keyboard shortcuts bypass a disabled button, so the same check has to guard the submit handler too.
- **Optimistic UI may lie about timing, never about outcome.** If the thing you just created would not
  be visible under the current view, do not fake it into the list — tell the user where it went.
- **Accessibility outranks pixel fidelity.** `:focus-visible` outlines stay even when a design removes
  them. Content a design hides on small screens is `sr-only`, not `hidden`, so live regions still
  announce.
- **One schema, two consumers.** The zod schema that validates a form is the same one the route
  handler validates against. Two definitions drift; one cannot.
- **A test asserts the accessibility contract, not the rendered text.** A field error is checked as
  "this input is programmatically invalid _and_ its accessible description carries the message", not
  as `getByText(message)` — which would pass on a stray `<div>` anywhere on screen and is not what a
  screen-reader user gets. The same instinct applies to queries: prefer roles and labels over test
  ids, and reach for a test id only when neither exists.

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

---

## When the UI feels slow

A playbook, because "it feels janky" is not yet a diagnosis. Record the interaction in the Performance
panel and first decide _which_ jank it is — the three fixes are unrelated:

- **Scripting** is almost always a re-render storm: an unstable list key, or something above the list
  re-rendering on every scroll event.
- **Layout** means forced synchronous reflow. In a virtualized list that is usually a measurement
  reading `offsetHeight` in a loop, or a size estimate wrong enough that the container height thrashes.
- **Paint** means too many layers.

Then the cheap checks, in order: count the mounted DOM rows (if the whole collection is there,
virtualization is not actually on), sanity-check `overscan`, and compare the row-height estimate
against the measured median. An estimate that has drifted makes `getTotalSize()` lie, the scrollbar
rubber-band, and the list _feel_ janky at a perfectly good 60 fps.

Whether it grew is a different question from what grew. The budget in
[`.size-limit.js`](.size-limit.js) fails the build on a size regression and answers the first;
`pnpm analyze` opens Turbopack's module graph, filtered by route, and answers the second.

---

**Run it:** see [`README.md`](README.md). What this app actually does, and what is still on its list:
[`docs/inner/ARCHITECTURE.md`](docs/inner/ARCHITECTURE.md).
