# Caching, server actions, and what any of it means for tests

A decision guide for Next.js App Router applications: when a write should be a server action and
when it should be a route handler, which of the four caches you are actually talking about, and what
follows for how the code gets tested.

Written against **Next.js 16 (App Router), React 19, TanStack Query v5**. Nothing below assumes a
particular codebase — where a judgement depends on facts about your app, the text says which fact and
how to check it.

---

## 1. The frame: reads and writes are different questions

Most of the confusion around "do I need a server action" comes from lumping them together. There are
three separate cases and only one of them is even a question.

| What you are doing                                       | What you need                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Read, inside a Server Component**                      | **Just call the function.** No action, no route handler, no fetch to yourself. |
| **Write, initiated by the client**                       | A server action **or** a route handler. This is the only real choice.          |
| **Read, after hydration** (pagination, filters, refetch) | A route handler + a client cache. A server action here is a mistake.           |

Row one is worth stating loudly: **server actions are not for reading.** They are POST-only, they are
never cached, and they are serialised one at a time (§7). A Server Component that needs data calls
the function:

```ts
// app/page.tsx — a Server Component
const queryClient = new QueryClient();
await queryClient.prefetchInfiniteQuery({
  queryKey: ['items', filters],
  queryFn: () => listItems(userId, filters, null, PAGE_SIZE),
});
```

`listItems` is a plain server function. Wrapping it in an action, or calling your own
`fetch('/api/items')` from a Server Component, only adds a round trip to yourself and loses the
direct types.

So the whole question reduces to row two.

---

## 2. Server action or route handler?

### What a server action actually gives you

| Advantage                           | Notes                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **A function reference, not a URL** | Nothing to invent, refactor-safe, no route registry, no call-site schema duplicated                   |
| **Progressive enhancement**         | `<form action={fn}>` posts **without JS**. The only item on this list that is _impossible_ with fetch |
| **The RSC round trip**              | `revalidatePath` / `updateTag` inside the action re-renders the RSC tree in the _same_ request        |
| **React's form primitives**         | `useActionState`, `useFormStatus`, `useOptimistic` are built for actions                              |
| **Security posture by default**     | Origin check, encrypted closed-over arguments, no public endpoint to guard                            |
| **Not a public API surface**        | A route handler is a URL anyone can call, and a contract you now half-own                             |
| **Smaller client bundle**           | Action bodies never ship to the browser                                                               |

### The rule

"The write should change what a Server Component renders" is not enough on its own — it matters _how
that content is cached_. The full decision:

```text
Where does the data being changed live?
│
├── In a client cache (TanStack Query, SWR)  ──►  ROUTE HANDLER.
│                                                 Invalidate the client cache. Nothing on the
│                                                 server needs to know. A server action buys
│                                                 literally nothing here.
│
└── Rendered by a Server Component
    │
    ├── The segment is STATIC / ISR / `use cache`  ──►  SERVER ACTION (or a route handler)
    │                                                   with `revalidateTag` / `updateTag` /
    │                                                   `revalidatePath`. This is where it
    │                                                   genuinely earns its keep: there is a
    │                                                   *server* cache to bust, and no amount
    │                                                   of client-side invalidation can touch
    │                                                   it — including for other users.
    │
    └── The segment is fully DYNAMIC  ──────────────►  Marginal. A server action bundles the
                                                       re-rendered RSC payload into the same
                                                       response; `route handler + router.refresh()`
                                                       gets the same result in two round trips
                                                       instead of one. A latency optimisation,
                                                       not a capability.
```

### How many round trips, really

The "extra round trip" is a property of **where the displayed data lives**, not of route handlers.
Spelled out, because the tree above is easy to over-read:

| The data on screen lives in | Mutation via                             | Round trips |
| --------------------------- | ---------------------------------------- | ----------- |
| A client cache              | route handler → `setQueryData(response)` | **1**       |
| A client cache              | server action → `setQueryData(response)` | **1**       |
| A Server Component          | server action + `revalidatePath`         | **1**       |
| A Server Component          | route handler + `router.refresh()`       | **2**       |

So: **if the data is in a client cache, both approaches are one round trip.** The POST returns the
updated resource, you write it into the cache, the UI re-renders. There is nothing to refresh,
because no Server Component is displaying it. The comparison only bites when a Server Component
renders the thing that changed.

Two clarifications that are easy to conflate:

- **Cache invalidation** — `revalidateTag` / `revalidatePath` having an actual _cache_ to bust —
  requires a prerendered segment, ISR, a cached `fetch`, or a `use cache` entry. On a fully dynamic
  segment there is nothing in the Full Route Cache. This is the part that is genuinely
  static/ISR/`use cache`-only.
- **Round-trip bundling** — the action's response carrying the re-rendered RSC payload — applies
  whenever the displayed data is rendered by a Server Component, **including dynamic SSR**. It is
  not static-only.

One honest caveat on the client-cache rows: if you `invalidateQueries` instead of writing the
response into the cache, you add a refetch and you are back to two round trips. That is a choice
about consistency, not a cost imposed by the transport — and doing both (reconcile the affected
entry via `setQueryData`, then invalidate so _other_ cached key combinations do not serve stale
lists) is a legitimate, deliberate trade.

### The reasons that survive the caching argument

Orthogonal to everything above, and true regardless of how anything is cached:

- **progressive enhancement** (`<form action={fn}>` works before hydration),
- **`useActionState` / `useFormStatus` / `useOptimistic`**,
- **not exposing a public URL**,
- **keeping the mutation body out of the client bundle**.

These are the reasons that hold when the caching argument does not. In most applications they point
at exactly one family of writes: **auth forms** — login, logout, signup — which are real `<form>`s,
want to work without JS, and set an httpOnly cookie.

### Locating your own app on that tree

Three checks, in order. They take about five minutes and they settle the argument.

1. **Run a production build and read the route legend.** The build prints a legend above the route
   table (static / prerendered / dynamic, plus a partial-prerender marker when Cache Components are
   on). If every route that matters is dynamic, the entire top half of §4 is a no-op for you.
2. **Grep for a server cache.** `'use cache'`, `unstable_cache`, `next: { tags`, `next: { revalidate`,
   `force-cache`, `export const revalidate`. No hits means the Data Cache is empty **by
   construction** — `revalidateTag` has nothing to invalidate and adding it changes nothing.
3. **Ask where the data on screen lives.** If the interactive parts read from TanStack Query and the
   server only prefetches into it, you are on the top branch: route handlers, and the caching case
   for server actions is worth roughly nothing.

A common shape worth naming, because it is self-refuting: an app that submits a form through a
**server action** and then calls `router.refresh()` on success — because the action never calls
`revalidatePath`. That app is paying for the second round trip anyway, while holding the tool whose
entire advantage was avoiding it. Either the action should do the invalidation, or the action was
never buying anything.

### What you do _not_ lose by moving to a route handler

- **`revalidateTag` / `revalidatePath` / `updateTag`** — callable from a route handler too (§4).
- **httpOnly cookies** — `NextResponse.cookies.set` does the same job as `cookies()`.
- **Type safety** — the validation schema still lives on the server; a typed fetch wrapper types the
  client. One schema, two call sites, no drift.

What you _do_ have to remember: a route handler is a public URL. Guard it. Session/authorisation
checks that a server action gets from its origin check and its non-public status become your job, so
put every handler behind one shared wrapper rather than re-implementing the check per file.

---

## 3. The four caches, and which one you mean

Half of all cache arguments are two people talking about different caches. There are four, they have
different owners, different lifetimes and different invalidation levers.

| Cache                  | Lives        | Holds                                            | Invalidated by                             | Scope         |
| ---------------------- | ------------ | ------------------------------------------------ | ------------------------------------------ | ------------- |
| **Full Route Cache**   | server / CDN | the prerendered RSC payload + HTML for a route   | `revalidatePath`, a new deploy             | **all users** |
| **Data Cache**         | server       | cached `fetch` results and `use cache` entries   | `revalidateTag`, `updateTag`, `cacheLife`  | **all users** |
| **Router Cache**       | the browser  | RSC payloads for visited routes, in memory       | `router.refresh()`, `revalidatePath`, time | this user     |
| **Client query cache** | the browser  | whatever your app fetched (TanStack Query / SWR) | `setQueryData`, `invalidateQueries`        | this user     |

The single most useful question when something is stale: **which of these four is holding the wrong
value?** The answer picks the tool, and the tools are not interchangeable.

### Next 16: Cache Components and `use cache`

Next 16 consolidates server caching behind one directive. With `cacheComponents: true` in
`next.config.ts`, a route splits into three kinds of content — static shell (prerendered), cached
(`use cache`), and dynamic (must be inside `<Suspense>`):

```tsx
export default function Page() {
  return (
    <>
      <Header /> {/* static — prerendered, instant */}
      <Stats /> {/* cached — see below */}
      <Suspense fallback={<Skeleton />}>
        <Notifications /> {/* dynamic — streams in per request */}
      </Suspense>
    </>
  );
}

async function Stats() {
  'use cache';
  cacheLife('hours');
  cacheTag('dashboard-stats');
  return <StatsDisplay stats={await db.stats.aggregate()} />;
}
```

`use cache` works at file, component or function level. `cacheLife` takes a built-in profile
(`'minutes' | 'hours' | 'days' | 'weeks' | 'max'`) or explicit `{ stale, revalidate, expire }`
seconds. `cacheTag` attaches invalidation handles.

Migration, for anything written against an older App Router:

| Old                              | Now                                          |
| -------------------------------- | -------------------------------------------- |
| `experimental.ppr`               | `cacheComponents: true`                      |
| `dynamic = 'force-static'`       | `'use cache'` + `cacheLife('max')`           |
| `export const revalidate = N`    | `cacheLife({ revalidate: N })`               |
| `unstable_cache(fn, keys, opts)` | `'use cache'` + `cacheTag()` + `cacheLife()` |
| `dynamic = 'force-dynamic'`      | remove — dynamic is the default              |

`use cache` generates its key automatically from the function's arguments **and its closure
variables**, so `keyParts` disappears. That automatic key is also the first of the subtleties below.

### Four subtleties of `use cache` that bite

**1. No runtime APIs inside.** `cookies()`, `headers()` and `searchParams` are unavailable inside a
`use cache` boundary. This is not an arbitrary restriction — it is the framework enforcing §5's rule
for you: anything request-scoped cannot be in a shared server cache. The fix is to read it outside
and pass it in:

```tsx
async function ProfilePage() {
  const sessionId = (await cookies()).get('session')?.value; // outside
  return <CachedProfile sessionId={sessionId} />;
}

async function CachedProfile({ sessionId }: { sessionId: string }) {
  'use cache'; // sessionId is now part of the cache key
  return <div>{(await fetchUser(sessionId)).name}</div>;
}
```

Read that second block carefully, because it is a trap as much as a solution: you have just created a
**per-user server cache entry**. Sometimes that is what you want. Usually it is the cache explosion
§5 warns about. `'use cache: private'` exists as an escape hatch when compliance rules force
per-user server caching, but reaching for it should feel like a decision, not a workaround.

**2. Closure variables are silently part of the key.** A cached function defined inside a component
closes over that component's props and captures them into the key:

```tsx
async function Component({ userId }: { userId: string }) {
  const getData = async (filter: string) => {
    'use cache'; // key = userId (closure) + filter (argument)
    return fetch(`/api/users/${userId}?filter=${filter}`);
  };
  return getData('active');
}
```

That is per-user cardinality nobody wrote down. Define cached functions at module scope, where the
key is visible in the signature.

**3. Non-deterministic values freeze.** `Math.random()`, `Date.now()`, `crypto.randomUUID()` inside a
`use cache` boundary execute **once**, when the entry is produced, and every cache hit replays that
value. For request-time randomness, stay outside the cache — `await connection()` from `next/server`
defers execution to request time.

**4. `use cache` needs a server.** Node runtime only; not available under static export.

---

## 4. `revalidateTag`, `updateTag`, `revalidatePath`

### What each one touches

| API                    | Invalidates                                                                                        | Timing                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `revalidateTag(tag)`   | Data Cache entries carrying that tag (tagged `fetch`, `cacheTag`) and routes that depended on them | background — the **next** request is fresh |
| `updateTag(tag)`       | The same entries, but refreshed **within the current request**                                     | immediate — this response is already fresh |
| `revalidatePath(path)` | The Full Route Cache for that path, and marks the client Router Cache stale                        | background                                 |

`updateTag` is the one to reach for after a mutation whose result the user must see immediately —
read-your-own-writes. `revalidateTag` is stale-while-revalidate: correct for "everyone else should
see this soon", wrong for "the person who just clicked must see it now".

All three are **server-only** (`next/cache`). All three work from a Server Action **and** from a
Route Handler. You cannot call them from the browser — but you never need to, because the write
already goes to the server, and that is where you call them.

### The underlying rule: "changed out of band"

> **You need `router.refresh()` or `revalidate*` only when server-rendered output depends on state
> you changed _out of band_.**

"Out of band" has a precise meaning. Next decides whether a previous server render is still usable
from the inputs it can _see_: the URL (pathname + search params), the segment config, and cache tags.
If the render also depends on an input Next cannot key on — **and that input changed without a
navigation** — the old output is wrong and nothing tells the framework.

Every legitimate reason to reach for these APIs is one of five.

**1. A cookie the render reads.** The canonical case. A login sets an httpOnly session cookie and a
layout renders from it; the URL did not change, so nothing signals that the previous render — made
without a session — is now wrong. Same shape for theme, locale, cart id, or an A/B bucket: the user
toggles dark mode, the cookie changes, the URL does not, and a cached render happily serves the old
class name.

**2. Another user wrote something.** User B posts; user A's page was rendered before it existed. No
request from A was involved in the change, so only a server-side invalidation (`revalidateTag('posts')`
in the write path) fixes it for everyone.

**3. Server-side in-memory or singleton state.** A module-scope `Map`, a process cache, a feature-flag
object mutated at runtime. A write mutates a singleton; if the reading route is prerendered, its
output stays wrong indefinitely with nothing to notice.

**4. Something outside the app changed the data.** A payment webhook flips a subscription to active; a
cron job imports rows; another service writes to the same database. No render was involved at all.
`revalidateTag`, called from the webhook's route handler, is the only lever that exists.

**5. Permissions changed elsewhere.** An admin grants a role in a back office. The user's own cookie
is unchanged, but what the server should render for them is not.

Note what is _absent_ from that list: anything whose data lives in a client query cache. There, the
write returns the new value and you put it in the cache — no server-rendered output is stale, because
none exists.

### Which tool for which staleness

| The stale thing is                                               | Tool                                             | Fixes it for |
| ---------------------------------------------------------------- | ------------------------------------------------ | ------------ |
| Cached **on the server** — wrong for everyone                    | `revalidateTag` / `updateTag` / `revalidatePath` | all users    |
| Correct on the server, but **this browser** holds an old payload | `router.refresh()`                               | this user    |
| Held in the **client query cache**                               | `setQueryData` / `invalidateQueries`             | this user    |

A useful test before writing any of them: **which server-rendered thing is wrong right now, and why
could the server not have known?** If the answer is "nothing — the data is in the query cache",
delete the line.

And when the answer is "a cookie changed", the better fix is usually none of the three.

### Worked example: the login flow

A very common client-side pattern, on successful login:

```tsx
router.push(safeFrom ?? '/');
router.refresh();
```

Case 1 from the list above — the action set a session cookie and a layout renders from it — so the
instinct is right. But it is usually the wrong implementation, for two reasons:

- If the destination is **dynamic**, it is not reused from the Router Cache anyway, so `push()`
  already fetches a fresh payload and `refresh()` adds nothing.
- `refresh()` applies to the **current** route, and `push()` is asynchronous. Depending on transition
  batching this can refresh the page being left rather than the destination. Note that this is not
  observable in jsdom, where `next/navigation` is mocked — it has to be checked in a running app.

**The idiomatic fix is a server-side redirect**, inside the action, immediately after the cookie is
set:

```ts
cookieStore.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: true });
redirect(safeFrom ?? '/');
```

One response carries both the cookie and the navigation; the destination renders on the server _with_
the new cookie; there is no client refresh and no ordering question. It also makes progressive
enhancement work end to end — with the navigation in client code, a no-JS form post sets the cookie
and then just sits there.

Two things move as a consequence, and both are improvements: the open-redirect check on the `from`
parameter becomes server-side, where it can actually be enforced; and any `onSuccess` callback the
form exposed to its parent needs a decision, because nothing runs after a server redirect.

What you would **not** do here is `revalidatePath('/auth/login')`. That busts a cache; the login page
is static and renders nothing session-dependent, so nothing about it is stale. The thing that changed
affects the destination, which is dynamic and therefore has no Full Route Cache entry to bust. A
no-op in both directions.

### When these APIs genuinely matter

1. The segment is **static, ISR, or `use cache`**, and its content comes from a source that changed.
2. You use **`fetch` with caching** — `force-cache`, `next: { revalidate }`, or `next: { tags }`.
3. **The write must be visible to other users.** Client cache invalidation only affects the person who
   performed the write; a server cache serves everyone.

If none of the three holds, `revalidateTag` in your codebase is decoration. Run check 2 from §2 —
that is exactly what it measures.

### Making tags meaningful for a non-`fetch` source

Tags attach to Next's cache, and a direct database or module read is not in it. To tag such a source
you have to put it in the cache explicitly:

```ts
export async function getPublishedPosts() {
  'use cache';
  cacheTag('posts');
  cacheLife('minutes');
  return db.post.findMany({ where: { published: true } });
}
```

Only now does `revalidateTag('posts')` have a target. Do this when a read is **shared across users
and expensive**. Do not do it for per-user reads — see the next section, and subtlety 1 in §3.

---

## 5. Server cache or client cache?

### The axis

> **Cache on the server what is shared and public. Cache on the client what is personal and
> interactive.**

The practical test:

> **If the cache key would have to contain a user id, it belongs on the client.**

A server cache keyed per user is a cache explosion and a data-leak surface at the same time — and, as
§3 showed, Next 16 enforces the first half of this for you by refusing `cookies()` inside `use cache`.

|                        | Server cache (Data Cache, Full Route Cache, ISR) | Client cache (TanStack Query, SWR)           |
| ---------------------- | ------------------------------------------------ | -------------------------------------------- |
| Who owns the data      | everyone                                         | this user                                    |
| Freshness expressed as | wall-clock ("at most 60s old")                   | events ("after a mutation", "on focus")      |
| What it buys           | first byte, SEO, one fetch serving N visitors    | optimistic updates, rollback, retries, dedup |
| Typical                | catalogue, articles, config, lookup tables       | feed, filters, pagination, drafts            |

The boundary is rarely ambiguous once you ask who the data belongs to. A feed that computes
`permissions: { canEdit, canDelete }` per requester is personal — the key would contain a user id, so
it belongs on the client. A dropdown of selectable authors or categories is shared and nearly static
— that is the genuine candidate for a server cache with a tag.

### Do not cache twice

`staleTime: 30_000` in the client cache _plus_ a 30-second server Data Cache gives you up to 60
seconds of staleness and behaviour nobody can reason about. **One layer owns freshness; the other is
only a transport.**

### The hybrid worth building

Server Component prefetches into a `QueryClient` → `dehydrate()` → `<HydrationBoundary>` → the client
hydrates the same cache:

```tsx
// app/page.tsx
const queryClient = getQueryClient();
await queryClient.prefetchInfiniteQuery({ queryKey: ['items', filters], queryFn: ... });

return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <Feed />
  </HydrationBoundary>
);
```

First paint is server-rendered; everything after is client-cached, with one cache and one source of
truth rather than two copies drifting apart. Configuring `shouldDehydrateQuery` to also dehydrate
_pending_ queries lets the shell stream without waiting on the slowest one.

---

## 6. The testing consequence

### Server Components are not testable in jsdom

Not "hard" — not really possible in a way that is worth the effort:

- They are async functions returning an RSC payload; React Testing Library cannot render them into a
  DOM you can drive.
- They have no state and no events, so there is nothing for a test driver to drive.
- The test runner cannot resolve the `react-server` export condition alongside client React in one
  module graph.
- Anything calling `cookies()` / `headers()` needs a request context that does not exist in a unit
  test — and any page behind auth calls one of them.

### So: three layers

1. **Extract the logic and test the logic.** A Server Component should be thin composition — `await` a
   service, pass props. The service is a plain function; test it as one, with no framework involved.
2. **Test the client boundary with a component test kit.** Everything interactive is a Client
   Component, and that is where driver/harness-style unit tests apply. The Server Component's
   remaining job shrinks to "prefetch the right query, pass the right props".
3. **Test the composition with an E2E runner.** "This user sees this data on this page" is a
   Playwright assertion. It is the only layer that actually renders the RSC tree.

There is a partial fourth option — a Server Component is an async function, so in a Node test you can
`const el = await Page(props)` and assert on the returned element tree. It works for pure, shallow
cases and breaks the moment there are nested async children or a `cookies()` call. Rarely worth it.

### The design rule that follows

> **Keep Server Components thin.**

This is the part that matters. "Almost everything _could_ be a Server Component" is true, and every
piece you move there moves out of unit-testable range and into the E2E budget — which is slower,
flakier, and runs later. A Server Component that awaits three services and branches on five
conditions has not just moved code; it has moved _untested_ logic into a place where testing it is
expensive.

The cost shows up in the tests first, but it is a design fact, not a test problem.

### And for the mutation boundary

Which transport you chose in §2 decides what a component test has to substitute:

- **Route handler** → the component makes an HTTP request. Intercept it with MSW. Nothing is mocked
  at the module level, the test speaks in requests and responses, and the same handlers work in the
  browser and in E2E.
- **Server action** → the component imports a function. Substituting it means module mocking, or
  passing the action in through a prop or a context provider so the test can supply a fake. The
  second is more work up front and far more stable; the first couples the test to import order.

This is a real input to the §2 decision, and it is usually left out of the discussion.

---

## 7. What the wider community says

The conclusions above are worth checking against the outside view — and the outside view is genuinely
split, so both halves are reported here.

### The official position

Next's own documentation is unambiguous: **Server Actions are the recommended way to handle form
submissions and data mutations in the App Router**
([Guides: Server Actions](https://nextjs.org/docs/app/guides/server-actions),
[How to create forms with Server Actions](https://nextjs.org/docs/app/guides/forms)). The stated
benefits are real:

- action code is **not included in the client bundle** — less JavaScript shipped;
- a single network round trip returns **both the updated UI and the refreshed data**;
- progressive enhancement: the form works before hydration;
- no public API endpoint to create, document, and guard.

### The practitioner critique

The counter-arguments cluster around concrete technical facts rather than taste.

**Sequential execution — the strongest one.** Server Actions execute **strictly one at a time**.
Several actions triggered together queue rather than run in parallel; there are reported cases of a
user switching tabs mid-request and the next request blocking until the first finished, leaving the
UI unresponsive. They are tightly coupled to React's rendering lifecycle, which makes them unsuited
to operations that must run in parallel without UI-driven synchronisation.
([Pasquale Favella](https://pasquale-favella.github.io/blog/27),
[u11d](https://u11d.com/blog/nextjs-server-actions-vs-api-routes-guide/),
[Amit Akuka](https://medium.com/@amit.akoka98/the-hidden-pitfalls-of-server-actions-in-next-js-a-real-world-lesson-1a8bc60759a9))

If your UI has create, edit and delete mutations that can plausibly overlap — any list a user can
act on quickly — this is the argument that should decide it.

**POST-only, never cached.** Every Server Action is a POST and is never cached. A route handler can
be a GET, which unlocks HTTP caching and CDN distribution. Using actions for _reads_ is called an
anti-pattern nearly unanimously — the same conclusion as §1.

**A weaker contract for teams.** POST-based data access is less predictable and harder to document;
actions "look like functions and hide risks that are obvious in a conventional API". A route handler
is inspectable in a network tab, callable from curl, and describable in an OpenAPI document.

**A client query library as the default for client-side server state.** The common position is that
TanStack Query takes over once data must stay in sync after the initial load — caching, background
refetching, optimistic updates
([Peerlist](https://peerlist.io/jagss/articles/exploring-tanstack-query-as-an-alternative-to-server-actions),
[DEV](https://dev.to/mericcintosun/tanstack-and-nextjs-the-de-facto-frontend-logic-layer-for-2026-4mal)).

### The middle path most teams land on

Wrap the action in a mutation:

```ts
useMutation({ mutationFn: followAuthorAction });
```

You keep the query cache, optimistic updates and retries, and the action keeps its security posture
and its lack of a public URL
([TkDodo, Mastering Mutations](https://github.com/TkDodo/blog-comments/discussions/70)).

For the _testing_ question specifically this changes nothing: `mutationFn` is still a module import,
so the substitution problem from §6 is untouched. It improves ergonomics, not the boundary.

### What is conspicuously absent

Almost none of this public discussion is about testing. The debate is about performance, caching and
ergonomics. "A Server Action is a poor test boundary" is a defensible position but not a widely held
one — if you adopt it, adopt it knowing that.

### Net

"Route handlers + fetch + a client query cache" is not a fringe preference; it is a mainstream
alternative with concrete technical backing, of which **sequential execution is the strongest single
argument**. Against it stands the official recommendation for forms, and that is exactly where it
holds.

A defensible default: **HTTP by default; server actions where there is a real form and progressive
enhancement matters** — in practice, auth.

---

## 8. Decision checklist

- [ ] Reading inside a Server Component? → call the function directly; no action, no self-`fetch`
- [ ] Client-initiated write, data in a client query cache? → route handler; a server action buys
      nothing
- [ ] Client-initiated write, data rendered by a STATIC / ISR / `use cache` segment? → this is the
      case server actions + `revalidateTag` exist for
- [ ] Same, but the segment is fully DYNAMIC? → marginal — one round trip instead of two, and only
      because a Server Component renders it (§2)
- [ ] Need progressive enhancement, `useActionState`, or no public URL? → server action, regardless
      of caching
- [ ] Reading after hydration (pagination, filters, refetch)? → route handler + client query cache
- [ ] Several mutations that can overlap? → route handlers — server actions execute strictly one at a
      time (§7)
- [ ] Using `revalidateTag`? → confirm a cached `fetch` or `use cache` entry exists for it to
      invalidate; otherwise it is a no-op
- [ ] Must the user who just wrote see the result immediately? → `updateTag`, not `revalidateTag`
- [ ] Anything request-scoped (`cookies`, `headers`, `searchParams`) inside `use cache`? → read it
      outside and pass it in — and then ask whether a per-user server cache entry is really what you
      want
- [ ] Cached function defined inside a component? → its closure is in the cache key; move it to
      module scope
- [ ] `Math.random()` / `Date.now()` inside `use cache`? → it froze at entry-creation time
- [ ] Would the cache key contain a user id? → client cache, not server cache
- [ ] Caching the same data on both layers? → pick one to own freshness
- [ ] Writing `router.refresh()` or `revalidate*`? → name the server-rendered thing that is wrong and
      why the server could not have known (§4). If the answer is "nothing, it is in the query cache",
      delete it
- [ ] Route handler added? → it is a public URL; confirm it goes through the shared auth wrapper
- [ ] Logic added to a Server Component? → could it live in a service that a unit test can call?
