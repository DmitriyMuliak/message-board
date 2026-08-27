# SSR and hydration

In an SPA the browser always started from an empty cache. Under SSR/RSC we want the HTML to arrive
**with the data already in it**, and then have TanStack Query pick that data up on the client and
keep managing it — refetching, caching, invalidating.

That handover is called **hydration**.

> This repo's own hydration setup, including the part where the prefetch is deliberately **not
> awaited**, is in [`architecture/data-layer.md`](../architecture/data-layer.md). This page is the
> general pattern.

## The pattern: prefetch and dehydrate

1. **Server (RSC):** create a `QueryClient`.
2. **Prefetch:** query the database or API right there on the server — no HTTP hop.
3. **Dehydrate:** freeze that cache into serializable JSON and put it in the HTML.
4. **Client:** React Query thaws the JSON back into its cache on load.
5. **Result:** when a component calls `useQuery`, it does **not** fetch. It has the data already.

## Next.js App Router

### Server component

Renders nothing itself — it prepares data.

```tsx
import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { getUsers } from '@/actions/getUsers';
import UserList from './user-list';

export default async function UsersPage() {
  const queryClient = new QueryClient();

  // Prefetch on the server. Note we call the server function directly —
  // no HTTP request to ourselves.
  await queryClient.prefetchQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserList />
    </HydrationBoundary>
  );
}
```

### Client component

Ordinary code — it reads as if this were an SPA.

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { getUsers } from '@/actions/getUsers';

export default function UserList() {
  // Reads from the HydrationBoundary immediately.
  // No request goes out; status is 'success' on first render.
  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
  });

  return (
    <div>
      {data?.map((user) => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

**What that buys:**

1. **SEO** — the HTML contains the list, because the boundary rendered the initial state.
2. **Speed** — content appears with no spinner.
3. **Interactivity** — once JS loads, React Query takes over. Switch tabs and come back, and
   `refetchOnWindowFocus` updates it.

The one rule that makes this safe: **dehydrated data travels with its query key**. A client asking
for a different key simply misses and fetches, so "right key, wrong data" cannot happen.

## The same thing with SWR

SWR uses a slightly simpler mechanism — the `fallback` option:

```tsx
import { SWRConfig } from 'swr';
import { getUsers } from '@/api/users';
import UserList from './user-list';

export default async function Page() {
  const users = await getUsers();

  return (
    <SWRConfig value={{ fallback: { '/api/users': users } }}>
      <UserList />
    </SWRConfig>
  );
}
```

```tsx
'use client';
import useSWR from 'swr';

export default function UserList() {
  // SWR finds '/api/users' in fallback and returns it immediately
  const { data } = useSWR('/api/users', fetcher);
  return <div>{data.name}</div>;
}
```

## "Why not just `await db.users()` in a server component?"

The right question. In the App Router you can render data with no library at all:

```tsx
export default async function Page() {
  const data = await db.query();
  return <div>{data.name}</div>;
}
```

**You need the library plus hydration when:**

1. **The data changes often** and you want polling or refetch-on-focus. A plain server component is a
   static snapshot taken at render time.
2. **Infinite scroll** — the server gives the first page, the client loads the rest.
3. **Optimistic updates** — you want the UI to change on click, without waiting for
   `router.refresh()`.
4. **Caching across navigations** — user goes to Profile and back to List. A server component
   re-renders (or hits the Next Data Cache); React Query returns from browser memory with no request
   at all.

## The rule

- **Static content** — a blog, docs, a footer → plain server components. Do not drag a query client
  in.
- **An interactive app** — dashboard, feed, task list → TanStack Query with `HydrationBoundary`. The
  server does the first heavy fetch; the client takes over for everything after.

---

Related: [Server Actions](./server-actions.md) · [Fetch on mount](./fetch-on-mount.md) ·
[This repo's data layer](../architecture/data-layer.md)
