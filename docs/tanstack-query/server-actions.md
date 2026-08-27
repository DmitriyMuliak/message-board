# TanStack Query and Server Actions

They compose — a Server Action is just an async function returning a promise, and that is exactly
what `queryFn` and `mutationFn` want. But the two directions are not equally good, and the reason is
not style. **Use Server Actions for mutations; prefer route handlers for queries.**

## It works, and the DX is excellent

End-to-end type safety with no hand-written interfaces. No `fetch`, no URL, no JSON parsing — you
import the server function into a client component and the return type flows through.

```ts
// actions/getUsers.ts
'use server';

export async function getUsers(page: number) {
  const users = await db.user.findMany({ skip: page * 10 });
  return users; // type inferred: User[]
}
```

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { getUsers } from '@/actions/getUsers';

export default function UserList({ page }: { page: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: () => getUsers(page), // just pass the function
  });

  if (isLoading) return <div>Loading…</div>;

  // `data` is exactly User[] — the type the ORM returned
  return (
    <div>
      {data?.map((user) => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

The same for a mutation, which is where this shape is unambiguously right:

```tsx
const { mutate, isPending } = useMutation({
  mutationFn: createUser, // the Server Action
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
});
```

## The catch: `AbortSignal` does not cross the boundary

This is the part tutorials leave out.

With a normal fetch, cancellation works end to end:

```ts
queryFn: ({ signal }) => fetch('/api', { signal }); // ✅ actually cancels the server request
```

With a Server Action it does **not**, for two reasons:

1. **Serialization.** Arguments crossing the Next.js boundary must be serializable, and an
   `AbortSignal` is not. Passing it throws: `Only plain objects can be passed to Client Components`.
2. **POST only.** Every Server Action is a `POST`.

So what actually happens when a query is cancelled — say the user navigates away?

1. TanStack Query marks the query cancelled in its own state, so the UI stops waiting.
2. The browser aborts the HTTP request to the Next.js server.
3. **But** the function on the server may run to completion anyway, depending on runtime and
   deployment. You cannot thread the signal down into the database to cancel a long SQL query.

## Why route handlers are better for reads

|                | Server Action                             | Route handler (`GET`)                        |
| -------------- | ----------------------------------------- | -------------------------------------------- |
| HTTP semantics | always `POST` — no browser or CDN caching | `GET`, cacheable                             |
| `AbortSignal`  | not available                             | `request.signal`, straight through to the DB |
| Deduplication  | weaker                                    | Next dedupes `fetch` well                    |

That is why using Server Actions as `queryFn` is considered an anti-pattern at scale, even though it
is allowed and pleasant.

## What TanStack Query adds on top either way

Worth stating, because "why not just call the action in a `useEffect`?" is the obvious question:

1. **Deduplication.** Call it from five components at once and one request goes out. A raw Server
   Action call goes out five times.
2. **Client cache.** Navigate away and back, and the data is there instantly instead of hitting the
   database again.
3. **Polling.** `refetchInterval` — see [`polling.md`](./polling.md). Doing this natively is painful.
4. **Loading state.** No hand-rolled `useState` for `isPending`.

## When to skip TanStack Query entirely

React 19 and Next 15+ ship `useActionState` and `useOptimistic`. For a simple login form or a
newsletter signup, TanStack Query is overhead — the native hooks plus a Server Action are the right
size.

**The rule:**

- **Simple mutations, forms** → Server Actions + `useActionState`.
- **Complex reads** — filters, search, charts, infinite scroll, realtime — → TanStack Query, with a
  route handler behind it.
- **Complex mutations that must invalidate a cache** → TanStack Query `useMutation` + Server Action.

## If you use an action as `queryFn` anyway

Fine, as long as the trade is understood:

```ts
useQuery({
  queryKey: ['data'],
  queryFn: async () => {
    // The signal cannot be forwarded. If the component unmounts, the query
    // ignores the result — but the server still does the work.
    return myServerAction();
  },
});
```

---

Related: [SSR and hydration](./ssr.md) · [Which cache a write invalidates](../nextjs/caching-and-server-actions.md)
