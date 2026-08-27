# Wiring an API client in

The idea: configure a global fetcher **once**, and let components use nothing but hooks. Both SWR and
TanStack Query support this; the shapes differ slightly.

> The API client being wired in here is the one from [`../api/api-calls.md`](../api/api-calls.md).
> Further reading on deliberately not over-abstracting the library:
> [Breaking React Query's API on purpose](https://tkdodo.eu/blog/breaking-react-querys-api-on-purpose).

## SWR

Simpler, and a good fit for Next.js or a mid-sized project.

**1. A global fetcher.** SWR passes the hook's first argument — the key — to it.

```ts
// lib/swrConfig.ts
import { SWRConfiguration } from 'swr';
import { apiService } from '@/services/api';

// adapter: SWR key → apiService call
export const swrFetcher = async (resource: string | [string, Record<string, unknown>]) => {
  if (Array.isArray(resource)) {
    const [url, params] = resource;
    return apiService.get(url, params);
  }
  return apiService.get(resource);
};

export const swrConfig: SWRConfiguration = {
  fetcher: swrFetcher,
  shouldRetryOnError: false, // the client may own retry logic already
  revalidateOnFocus: false,
};
```

**2. Wrap the app:**

```tsx
import { SWRConfig } from 'swr';
import { swrConfig } from '@/lib/swrConfig';

export default function App({ Component, pageProps }) {
  return (
    <SWRConfig value={swrConfig}>
      <Component {...pageProps} />
    </SWRConfig>
  );
}
```

**3. Use it** — declarative, no `useEffect`:

```tsx
const UserProfile = ({ userId }: { userId: number }) => {
  // key as a plain URL:            useSWR<User>('/users/me')
  // key as [url, params]:          becomes fetcher(url, params)
  const { data, error, isLoading } = useSWR<User>(['/users', { id: userId }]);

  if (isLoading) return <div>Loading…</div>;
  if (error) return <div>Error loading user</div>;

  return <h1>{data?.name}</h1>;
};
```

## TanStack Query

More boilerplate, considerably more control. A `defaultQueryFn` lets every query fall through to your
client unless it says otherwise.

```ts
// lib/queryClient.ts
import { QueryClient, QueryFunctionContext } from '@tanstack/react-query';
import { apiService } from '@/services/api';

const defaultQueryFn = async ({ queryKey }: QueryFunctionContext) => {
  // a query key is always an array — the convention here is [URL, params]
  const [url, params] = queryKey as [string, Record<string, unknown> | undefined];
  return apiService.get(url, params);
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});
```

```tsx
const UserProfile = ({ userId }: { userId: number }) => {
  const { data, isPending, isError } = useQuery<User>({
    // this array reaches defaultQueryFn → apiService.get('/users', { id: userId })
    queryKey: ['/users', { id: userId }],
    enabled: !!userId, // do not fire until the id exists
  });

  if (isPending) return <div>Loading…</div>;
  if (isError) return <div>Error…</div>;

  return <div>{data.name}</div>;
};
```

> A `defaultQueryFn` that derives the URL from the key is convenient and has a cost: the key stops
> being an opaque cache identifier and becomes a route. This repo does **not** do that — keys are
> built by the entity that owns them, and each hook declares its own `queryFn`. See
> [`architecture/data-layer.md`](../architecture/data-layer.md).

## Do not call the hooks straight from components

Even `useQuery` inside a component is not ideal on a large project. Wrap it in a **custom hook** —
that is where cache keys get encapsulated.

```ts
// hooks/useUsers.ts
export const useUser = (id: number) => {
  const { data, error, isLoading, mutate } = useSWR<User>(['/users', { id }]);

  return {
    user: data,
    isError: !!error,
    isLoading,
    refreshUser: mutate, // abstract the refresh mechanism away too
  };
};
```

```tsx
const UserProfile = ({ id }) => {
  // the component knows nothing about URLs, the API, or which library is underneath
  const { user, isLoading } = useUser(id);

  if (isLoading) return <Loader />;
  return <div>{user?.name}</div>;
};
```

This is the layer that makes the code reusable and testable, and it is what lets you swap SWR for
TanStack Query — or a Server Action — without touching a single component.

---

Next: [Mutations and optimistic updates](./mutations.md) ·
[Reading query state](./query-states.md)
