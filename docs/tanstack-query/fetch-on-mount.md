# The double fetch on mount, and how to stop it

The classic SSR complaint: the server already fetched the data during HTML generation, so why does
the browser fetch it again the moment the component mounts?

Because **by default it is supposed to** — and the fix is one config line, but not the one most
people reach for first.

## Why it happens

If you have not set `staleTime`, it is **0**. So:

1. The component mounts.
2. It sees the hydrated data and renders it **immediately** — no spinner.
3. With `staleTime: 0`, that data counts as stale the instant it arrives.
4. React Query starts a **background refetch**.

You will not notice it in the UI, because `isLoading` stays `false` — there is data. Check
`isFetching` instead, or the Network tab.

## The fix: `staleTime`

This is the only correct way to tell React Query _"the data that came from the server is still fresh,
leave it alone for a while"_.

### Locally

```ts
const { data } = useQuery({
  queryKey: ['users'],
  queryFn: () => getUsers(),
  staleTime: 60 * 1000, // treat as fresh for a minute
});
```

What happens now:

1. The component mounts.
2. React Query sees the hydrated data — **and its timestamp**, which travels with the dehydrated
   state.
3. The data was fetched on the server 500 ms ago. `500ms < 1min` → fresh.
4. **No background request.**

### Globally — the better default

`staleTime: 0` is aggressive for most applications; data rarely goes stale instantly. Set the default
once, where the client is created:

```ts
const [queryClient] = useState(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
          // with a real staleTime, focus refetching is usually redundant
          refetchOnWindowFocus: false,
        },
      },
    }),
);
```

A page that genuinely needs live data — exchange rates, a job status — overrides it locally with
`staleTime: 0`.

> In this repo the per-resource version of that decision is
> [rule 7](../architecture/lint-rules.md): app-wide defaults live in `makeQueryClient`, anything
> resource-specific is registered with `setQueryDefaults` at the composition root.

## The trap: `refetchOnMount: false`

There is a second way to silence the request:

```ts
useQuery({
  queryKey: ['users'],
  queryFn: () => getUsers(),
  refetchOnMount: false, // ⚠️
});
```

It works, and it is dangerous. The reason is that **the App Router behaves like an SPA**, and Next
keeps its own client-side Router Cache.

### The scenario where it bites

1. **00:00:00** — user opens `/users`. The server reads the database (name: "Ivan"), React Query
   receives it through hydration. Cache: `['users'] = "Ivan"`.
2. **00:00:10** — user clicks `<Link href="/settings">`. `UsersPage` unmounts, but the React Query
   cache **stays in JS memory** — this is an SPA.
3. **00:00:20** — an admin renames "Ivan" to **"Petro"** in the database.
4. **00:00:25** — user navigates back to `/users`. **Next does not go to the server**: its client
   Router Cache still holds the RSC payload from 25 seconds ago, with "Ivan" in it.
5. **Mount** — React Query asks itself "do I have data?" Yes, "Ivan". `refetchOnMount: false` says
   do not check freshness.

**Result:** the user sees "Ivan". The database says "Petro". Next did not refresh the page because of
its router cache, and React Query did not ask because you forbade it.

### Why `staleTime` is safe where that is not

Same scenario, with `staleTime: 60 * 1000` instead:

- **Back after 25 seconds** — data is 25 s old, under the minute → no request. Exactly the behaviour
  you wanted.
- **Back after two hours** — the Next Router Cache has expired, so Next re-fetches the page anyway;
  and even if it did not, React Query sees data older than a minute and **refetches in the
  background**.

`refetchOnMount: false` makes you rely on Next always bringing fresh data on navigation. The Router
Cache means that is **not guaranteed**. `staleTime` achieves the same thing at startup while still
protecting you when the data really is old.

## When you do want to force it

If a global `staleTime` is set but one screen must always re-check on mount:

```ts
useQuery({
  queryKey: ['users'],
  queryFn: () => getUsers(),
  refetchOnMount: 'always', // ignore staleTime, always fetch on mount
});
```

Doing it by hand is possible but considered dirty — it duplicates logic the library already has:

```ts
// not recommended
const { refetch } = useQuery({ queryKey: ['users'], queryFn: getUsers, enabled: false });
useEffect(() => {
  refetch();
}, []);
```

## One more suspect

If the request _does_ go out but the data still looks stale, the culprit may be a layer further back:
React Query calls the Server Action, and **Next's own cache** answers from its own memo without
touching the database. `revalidatePath`, `revalidateTag` or `cache: 'no-store'` on the server side is
the remedy — see [caching and server actions](../nextjs/caching-and-server-actions.md).

## Summary

| Goal                                | Setting                                             |
| ----------------------------------- | --------------------------------------------------- |
| No double fetch after SSR           | `staleTime > 0` — globally, ideally                 |
| Always re-check when a screen opens | `refetchOnMount: 'always'`                          |
| Never re-check on mount             | `refetchOnMount: false` — avoid; see the trap above |

---

Related: [SSR and hydration](./ssr.md) · [`placeholderData`](./placeholder-data.md)
