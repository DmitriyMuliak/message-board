# `placeholderData` / `keepPreviousData` — how it works and when it lies

A field guide to one TanStack Query option that is easy to switch on, hard to see, and occasionally
dangerous. Written against **`@tanstack/query-core@5.101.2`**; line references point at the built ESM
in `node_modules`, so you can open them and check rather than trust this document.

Short version:

> `keepPreviousData` makes a query report **`status: 'success'` with data that belongs to a different
> query key**. That is exactly what you want for a filter change on one list, and exactly what you do
> not want anywhere else. It must never be a client-wide default.

---

## 1. What the option actually does

`keepPreviousData` is not special machinery — it is a one-liner passed as `placeholderData`:

```ts
const keepPreviousData = (previousData) => previousData;
```

When the query key changes to one that has **no data in the cache**, the observer does not report
"nothing yet". It reports the previous key's data as a placeholder:

| field               | without the option | with the option              |
| ------------------- | ------------------ | ---------------------------- |
| `status`            | `'pending'`        | `'success'`                  |
| `isPending`         | `true`             | **`false`**                  |
| `data`              | `undefined`        | **data of the previous key** |
| `isPlaceholderData` | `false`            | `true`                       |
| `isFetching`        | `true`             | `true`                       |

Four properties follow from the implementation, and every trap below is a consequence of one of them:

1. **`isPending` is false on a key change.** Any `if (isPending) return <Skeleton />` stops firing.
2. **`data` and `queryKey` describe different things** for the duration of the fetch.
3. **The placeholder is never written to the cache.** It is computed per observer, in
   `createResult()`. The new key's `Query` stays `pending` in the cache.
4. **It needs a previous.** It only fires if _this observer_ previously held data. On a fresh mount
   there is nothing to keep, so you get an ordinary `pending`.

Property 4 is worth pausing on: the same component renders differently depending on whether the user
arrived by switching a filter or by mounting the screen fresh.

---

## 2. Where `previousData` actually lives

Three objects get conflated constantly. They have different lifetimes.

```
QueryClient
└── QueryCache                      ← Map: hash(queryKey) → Query
    ├── Query ['message','A']       ← THE DATA LIVES HERE: query.state.data
    └── Query ['message','B']
         ▲
         │ observers: [observer₁, observer₂, …]
         │
    QueryObserver                   ← one per useQuery() call; lives as long as the mount
      #currentQuery                 → the Query it is subscribed to right now
      #lastQueryWithDefinedData     → the last Query it saw that had data
```

`previousData` is **not stored anywhere separate**. It is `state.data` of the _old_ `Query`, which is
still sitting in the cache. The observer only remembers _which_ `Query` that was — a reference, not a
copy.

Written in `updateResult()` — `query-core/build/modern/queryObserver.js:382`:

```js
if (this.#currentResultState.data !== void 0) {
  this.#lastQueryWithDefinedData = this.#currentQuery; // a reference
}
```

Read in `createResult()` — `queryObserver.js:265-280`:

```js
if (options.placeholderData !== void 0 && data === void 0 && status === 'pending') {
  placeholderData =
    typeof options.placeholderData === 'function'
      ? options.placeholderData(
          this.#lastQueryWithDefinedData?.state.data, // ← your `previousData`
          this.#lastQueryWithDefinedData, // ← the old Query itself
        )
      : options.placeholderData;

  if (placeholderData !== void 0) {
    status = 'success'; // local to this observer's result
    isPlaceholderData = true;
  }
}
```

Note where `status = 'success'` is assigned: inside `createResult`. It never reaches the cache.

### When is it deleted

Unmounting a component destroys the **observer**, not the data. `useBaseQuery` builds the observer
with `useState(() => new Observer(...))` and subscribes via `useSyncExternalStore`
(`react-query/build/modern/useBaseQuery.js:49-62`), so the observer is tied to the mount.

On unmount (`query.js:155-167`):

```js
removeObserver(observer) {
  this.observers = this.observers.filter((x) => x !== observer);
  if (!this.observers.length) {
    this.scheduleGc();          // a TIMER, not a deletion
  }
}
```

and only after `gcTime` elapses (default **5 minutes**), `query.js:63-67`:

```js
optionalRemove() {
  if (!this.observers.length && this.state.fetchStatus === 'idle') {
    this.#cache.remove(this);   // now the data is really gone
  }
}
```

| on unmount                     | fate                                                       |
| ------------------------------ | ---------------------------------------------------------- |
| `QueryObserver`                | destroyed immediately, `#lastQueryWithDefinedData` with it |
| old key's `Query` in the cache | stays; GC timer armed for `gcTime`                         |
| `query.state.data`             | still readable that whole time                             |

If a new observer subscribes before the timer fires, `addObserver()` calls `clearGcTimeout()` and the
query is rescued.

**So: unmounting does not drop data. It drops the bridge to it.** That distinction is the whole basis
of fix #4 below.

---

## 3. Why the failure is silent

There is no compile-time signal — and that is not an accident of this codebase, it is how the types
work.

When `placeholderData` is passed **in the hook's options**, TanStack narrows the result to
`DefinedUseQueryResult`: `data` stops being `undefined` and you can see something changed. When it
comes from **client defaults**, the types are untouched: `data` is still `T | undefined`, `status` is
still the same three-member union.

Which means the guard you wrote still compiles, still narrows, still looks correct:

```tsx
const { data, isPending } = useQuery({ queryKey: ['message', messageId], queryFn: fetchMessage });

if (isPending) return <Skeleton />; // ✅ typechecks ✅ narrows 🔴 never runs on a key change
return <p>{data.content}</p>; //    data belongs to the previous messageId
```

Nothing errors. Nothing warns. The only difference is a line someone added in
`shared/api/query-client.ts`, three directories away, months ago.

---

## 4. The two failure shapes

### 4.1 Cosmetic: the label contradicts the data

`server/messages-service.ts` already computes a `total` (currently commented out of the response).
Suppose it ships and someone renders a list header:

```tsx
function FeedHeader({ filters }: { filters: FeedFilters }) {
  const { data, isPending } = useQuery({
    queryKey: messageKeys.list(filters),
    queryFn: () => fetchMessages(filters),
  });

  if (isPending) return <Skeleton />;
  return (
    <p>
      {data.total} messages tagged {filters.tags.join(', ')}
    </p>
  );
}
```

You tap the `DESIGN` chip while `PRODUCT` is active. For the length of the request the screen says:

> **128 messages tagged DESIGN**

`128` is `PRODUCT`'s total; `DESIGN` comes from the prop. No spinner, because `isPending` is false.

This is the general shape: **the moment anything derived from the current key is rendered next to
`data`** — a prop, the URL, a chip, a heading — you get a self-contradicting pair.

### 4.2 Real: an action taken on someone else's record

Worse is reading an **identifier** out of placeholder data:

```tsx
function MessageActions({ messageId }: { messageId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ['message', messageId],
    queryFn: () => fetchMessage(messageId),
  });

  if (isPending) return null;

  return <Button onClick={() => deleteMutation.mutate(data.id)}>DELETE</Button>;
}
```

```
t0   MessageActions messageId="A"     observer₁ → Query[A], data = A ✓
                                      #lastQueryWithDefinedData = Query[A]

t1   messageId becomes "B"
     #currentQuery → Query[B]         Query[B].state.data === undefined
     placeholder   = Query[A].state.data
     status: 'success'   data: A      🔴 button enabled, data.id === "A"

t2   fetch(B) resolves                data = B ✓
```

The window between `t1` and `t2` is a full round trip — `MOCK_LATENCY_MS` is 400 ms by default here.
Long enough to click. `data` is typed as a complete `Message`, `status` says `success`, the button
looks healthy, and the wrong message gets deleted.

The only thing that gives it away is `isPlaceholderData`, which you have to already know about.

---

## 5. The rule: refinement vs. different subject

A global default cannot get this right, because the answer is semantic — it depends on what the new
key _means_ relative to the old one:

| new key is…                                                          | old data is…                         | keep it? |
| -------------------------------------------------------------------- | ------------------------------------ | -------- |
| a **refinement of the same collection** — filter, page, sort, search | "the same thing, not recomputed yet" | ✅ yes   |
| a **different subject** — user A → B, message 1 → 2                  | **someone else's record**            | 🔴 never |

`defaultOptions.queries` applies to both identically, because it has no way to tell them apart. That
is why the option belongs next to the resource it describes, not in the global client — the same
locality argument that moved `FeedFilters` out of `features/feed-filters` and into
`entities/message`.

Good uses:

- Paginated / filtered / sorted lists — the list keeps its height, the scroll position survives, no
  skeleton flash. This is the feed.
- Search-as-you-type — results stay legible between keystrokes.

Bad uses:

- Anything keyed by an entity id.
- Anything whose `data` supplies an id, slug, or version to a subsequent action.
- A client-wide default. Always.

---

## 6. Four ways to get it right

Ordered by how much they rely on the reader being careful. Prefer the ones that don't.

### 6.1 Scope it to the resource (what this repo does)

The policy lives with the entity that owns the key; the composition root wires it in:

```ts
// entities/message/api/queries.ts — the policy
export const messageListQueryDefaults = {
  placeholderData: keepPreviousData,
};

// app/providers.tsx — the wiring
client.setQueryDefaults(messageKeys.all, messageListQueryDefaults);
```

`setQueryDefaults` matches by key prefix, so this reaches every `['messages', …]` query and nothing
else. A query added next year under a different key inherits nothing.

### 6.2 Render it honestly

If you show stale data, say so. Otherwise the UI asserts something it cannot back up:

```tsx
const { data, isPlaceholderData } = useQuery({ …, placeholderData: keepPreviousData });

<div className={isPlaceholderData ? 'opacity-60' : undefined} aria-busy={isPlaceholderData}>
```

`aria-busy` matters as much as the opacity — a screen-reader user has no dimming to notice.

### 6.3 Guard on the previous key

`placeholderData` receives the old `Query`, not just its data. Use it to refuse a subject change:

```ts
useQuery({
  queryKey: ['message', messageId],
  placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === messageId ? prev : undefined), // undefined → back to `pending`
});
```

Returning `undefined` skips the `if (placeholderData !== void 0)` branch entirely, so you get a
normal loading state. This is precise — and it is precisely what a global default cannot express,
because it requires knowing the key's semantics.

### 6.4 Make the bad state unrepresentable — `key`

For "different subject" queries, remount instead of remembering:

```tsx
<MessageActions key={messageId} messageId={messageId} />
```

```
key="A"  →  observer₁: #lastQueryWithDefinedData = Query['message','A']
   ↓ key changes — React unmounts, then mounts fresh
key="B"  →  observer₂: #lastQueryWithDefinedData = undefined
                        ↓ keepPreviousData(undefined) → undefined
                        ↓ placeholder branch skipped
            status stays 'pending' → skeleton ✓
```

Worth being exact about why this works, because it is easy to describe wrongly: **`key` does not
delete the data.** `Query['message','A']` stays in the cache for its full `gcTime`. What dies is the
new observer's `#lastQueryWithDefinedData`, which starts out `undefined`. And because the old data is
still cached, navigating back to `A` within `gcTime` is an instant cache hit — real data,
`isPlaceholderData: false`, no placeholder involved.

Same move as the app's calendar-instead-of-two-date-inputs decision: remove the ability to represent
the invalid state rather than remembering to check for it.

---

## 7. `placeholderData` vs `initialData`

They look interchangeable and are not:

|                            | `placeholderData`               | `initialData`                                      |
| -------------------------- | ------------------------------- | -------------------------------------------------- |
| Written to the cache       | **No** — per observer           | **Yes** — becomes the query's real data            |
| Counts as fetched data     | No; a background fetch runs     | Yes; subject to `staleTime` and may not refetch    |
| Visible to other observers | No                              | Yes                                                |
| Detectable                 | `isPlaceholderData`             | `isInitialData` does not exist — indistinguishable |
| Use it for                 | "show something while we fetch" | "we genuinely already have this data"              |

`initialData` with a wrong `staleTime` is the classic way to pin stale data in the cache
indefinitely. This repo avoids the whole question by hydrating with `dehydrate()` +
`<HydrationBoundary>` instead — see `ARCHITECTURE.md` → _Data — TanStack Query, hydrated with its
key_.

---

## 8. The Suspense caveat

The two suspense hooks disagree, and it is not documented anywhere obvious:

- **`useSuspenseQuery` strips it.** `react-query/build/modern/useSuspenseQuery.js:19` passes
  `placeholderData: void 0` into `useBaseQuery`, overriding any default. It never applies.
- **`useSuspenseInfiniteQuery` does not strip it.** Client defaults reach it, and since
  `shouldSuspend()` tests `result.isPending`, a placeholder makes the component **not suspend at
  all**.

Meanwhile the types forbid what the runtime allows:

```ts
// _tsup-dts-rollup.d.ts:905
interface UseSuspenseInfiniteQueryOptions<…>
  extends OmitKeyof<UseInfiniteQueryOptions<…>, 'queryFn' | 'enabled' | 'throwOnError' | 'placeholderData'>

// :911
type UseSuspenseInfiniteQueryResult<TData, TError> =
  OmitKeyof<DefinedInfiniteQueryObserverResult<TData, TError>, 'isPlaceholderData' | 'promise'>
```

Two consequences for this codebase:

1. You **cannot pass it to the hook** — a query default is the only place it type-checks. Hence
   §6.1's `setQueryDefaults` rather than an option on `useMessagesInfinite`.
2. You **cannot detect it** — `isPlaceholderData` is omitted from the result. That is why
   `views/feed/ui/MessageList.tsx` only sets `aria-busy={isFetching}` and has no dimming: §6.2 is not
   implementable on this hook.

Treat point 1 as a library inconsistency rather than a contract. If it is ever aligned with
`useSuspenseQuery`, the supported replacement is React's `useTransition` around the filter write in
`useFeedFilters` — the old list stays mounted while the new one suspends, which is the same effect
through a mechanism React actually guarantees.

---

## 9. Review checklist

- [ ] Is `placeholderData` set in `defaultOptions.queries`? If yes, that is a bug regardless of what
      it does today — move it to `setQueryDefaults(<resource key>, …)`.
- [ ] For each query using it: is the new key a **refinement** of the old, or a **different
      subject**? Different subject → drop it, or guard with `previousQuery` (§6.3), or `key` the
      component (§6.4).
- [ ] Does any `onClick` / mutation read an **id, slug, or version** out of `data`? If so it can act
      on the previous key's record.
- [ ] Is stale data rendered without `isPlaceholderData` styling **and** `aria-busy`?
- [ ] Is `keepPreviousData` imported from the library rather than written inline as `(prev) => prev`?
      `createResult` compares the function by reference (`queryObserver.js:267`) to skip re-running
      `select`; a fresh arrow each render defeats that. Correctness is unaffected, work is not.

---

## 10. Source map

Everything above is checkable. Paths are relative to `node_modules/@tanstack/*/build/modern/`, at
`5.101.2`:

| What                                         | Where                                       |
| -------------------------------------------- | ------------------------------------------- |
| `#lastQueryWithDefinedData` declaration      | `query-core/queryObserver.js:40`            |
| Placeholder computation                      | `query-core/queryObserver.js:265-280`       |
| Assignment of the "previous" pointer         | `query-core/queryObserver.js:382`           |
| Observer removal → GC timer                  | `query-core/query.js:155-167`               |
| Actual cache eviction                        | `query-core/query.js:63-67`                 |
| GC timer                                     | `query-core/removable.js:10-15`             |
| Observer created per mount + subscription    | `react-query/useBaseQuery.js:49-62`         |
| `useSuspenseQuery` stripping the option      | `react-query/useSuspenseQuery.js:19`        |
| `useSuspenseInfiniteQuery` **not** stripping | `react-query/useSuspenseInfiniteQuery.js`   |
| `shouldSuspend` = `suspense && isPending`    | `react-query/suspense.js`                   |
| Suspense option/result type omissions        | `react-query/_tsup-dts-rollup.d.ts:905,911` |
