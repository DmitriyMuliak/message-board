# Shaping data, lists, and what a store is still for

If you come from Redux, the store was the single source of truth: normalized data went in, components
read prepared slices out. TanStack Query changes that split, and the first thing to internalise is:

**you do not need Zustand to transform server data.**

The library has the mechanism that replaces selectors and reducers. It is called `select`.

## 1. Transforming data — the replacement for selectors

Redux: `API → reducer (reshapes) → store → component`.
TanStack Query: `API → cache (stores as-is) → select (reshapes for the UI) → component`.

`select` takes the raw server response and returns what the component actually wants. **It is
memoized** — it re-runs only when the data changes or the function identity changes, so a re-render
for unrelated reasons does not recompute the array.

### Preparing rows for a table

Backend returns a nested shape; the table wants a flat one.

```ts
interface RawUser {
  id: number;
  attributes: {
    firstName: string;
    lastName: string;
    metadata: { lastLogin: string };
  };
}

interface TableRow {
  id: number;
  fullName: string;
  lastSeen: string;
}

const useUsersTable = () =>
  useQuery({
    queryKey: ['users'],
    queryFn: apiService.getUsers,

    // this is your reducer / selector
    select: (data: RawUser[]): TableRow[] =>
      data.map((user) => ({
        id: user.id,
        fullName: `${user.attributes.firstName} ${user.attributes.lastName}`,
        lastSeen: new Date(user.attributes.metadata.lastLogin).toLocaleDateString(),
      })),
  });
```

The component receives a finished `TableRow[]` with a stable reference.

**Keep the cache raw.** `select` shapes on the way _out_, so two components can derive different
views from one cache entry, and an invalidation still means one refetch.

## 2. Pagination and lists

In Redux this was where the monstrous reducers lived — concatenating `[...oldData, ...newData]`,
tracking `currentPage`. Neither is needed.

### Ordinary pagination

Do not keep every page in a store. Each page is its own cache entry under its own key:

```ts
const [page, setPage] = useState(1);

const { data } = useQuery({
  queryKey: ['users', page],
  queryFn: () => fetchUsers(page),
  // keep the previous page on screen while the next one loads
  placeholderData: keepPreviousData,
});
```

`keepPreviousData` is what stops the UI flashing a spinner on every page change. It has sharp edges
worth knowing before you rely on it — see
[`placeholder-data.md`](./placeholder-data.md).

### Infinite scroll

`useInfiniteQuery` manages the array of pages itself. No concatenation reducer:

```ts
const { data, fetchNextPage } = useInfiniteQuery({
  queryKey: ['users', 'infinite'],
  queryFn: ({ pageParam = 1 }) => fetchUsers(pageParam),
  getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
});

// data.pages is an array of pages; flatten for rendering
const allUsers = data?.pages.flatMap((page) => page.users) ?? [];
```

## 3. So what is Zustand for?

Not for data. For **the parameters of the request**.

The shape that works:

1. **Zustand (or the URL)** holds filters, sorting, page number, which modal is open.
2. **TanStack Query** watches those and fetches, caches and transforms accordingly.

```ts
// 1. Store: lightweight UI parameters only
const useFiltersStore = create((set) => ({
  search: '',
  status: 'active',
  setSearch: (search) => set({ search }),
}));

// 2. Query: reacts to them
const useFilteredUsers = () => {
  const { search, status } = useFiltersStore();

  return useQuery({
    // key changed → new request, automatically
    queryKey: ['users', { search, status }],
    queryFn: () => apiService.getUsers({ search, status }),
    select: (data) => data.map((u) => ({ ...u, key: u.id })),
  });
};
```

> In this repo that role is played by the **URL** rather than a store — filters live in search params,
> which makes every view shareable for free. See
> [`architecture/data-layer.md`](../architecture/data-layer.md). A store is the right tool when the
> parameter should _not_ be in the URL.

## The rule

| Need                                   | Tool                       |
| -------------------------------------- | -------------------------- |
| Reshape server data for a view         | `select` inside `useQuery` |
| Stitch pages into one list             | `useInfiniteQuery`         |
| Filters, tabs, page index, open modals | Zustand, or the URL        |

**Never mirror a server response into a store.** That is a second source of truth, and keeping the
two in sync is exactly the problem this architecture exists to remove.
