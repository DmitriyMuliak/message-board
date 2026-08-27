# Reading query state — which flag means what

`useQuery` returns more state than most people use, and picking the wrong flag is the difference
between a spinner that flashes on every navigation and one that never appears when it should.

Four things matter: `isPending`, `isFetching`, `isStale`, `dataUpdatedAt`.

## The distinction that trips everyone up

- **`isPending`** (`isLoading` in v4) — there is **no data at all**. First run.
- **`isFetching`** — a request is in flight **right now**, whether or not data already exists.

A background refresh has `isFetching: true` and `isPending: false`. If you drive your skeleton off
`isFetching`, it will replace good content with a skeleton every time the window regains focus.

## Scenario 1 — background refresh

Data is on screen; you want a discreet hint that it is being re-checked.

```tsx
const { data, isFetching } = useQuery({ queryKey: ['users'], queryFn: getUsers });

return (
  <div style={{ opacity: isFetching ? 0.7 : 1 }}>
    <h1>
      Users
      {isFetching && <span className="spinner">Refreshing…</span>}
    </h1>

    {data?.map((user) => (
      <div key={user.id}>{user.name}</div>
    ))}
  </div>
);
```

## Scenario 2 — "this came from cache"

`isStale` flips to `true` once `staleTime` has elapsed.

```tsx
const { data, isStale } = useQuery({
  queryKey: ['users'],
  queryFn: getUsers,
  staleTime: 1000 * 60 * 5,
});

return (
  <div>
    {isStale ? <Badge tone="warn">Cached</Badge> : <Badge tone="ok">Up to date</Badge>}
    <UserList data={data} />
  </div>
);
```

**Careful:** with the default `staleTime: 0`, `isStale` is **always true** immediately after the data
arrives. The flag is only meaningful if you have actually set a `staleTime`.

## Scenario 3 — "last updated 5 minutes ago"

Usually better than telling the user the word "cache". `dataUpdatedAt` is a timestamp of the last
successful fetch.

```tsx
const { data, dataUpdatedAt } = useQuery({ queryKey: ['users'], queryFn: getUsers });

return (
  <header>
    <h1>Dashboard</h1>
    <small>Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}</small>
  </header>
);
```

## Scenario 4 — offline

`fetchStatus` is separate from the data status and can be `'fetching'`, `'paused'` or `'idle'`.
`paused` means "we want to fetch but there is no network" — exactly what a PWA needs to surface.

```tsx
const { fetchStatus, isPaused } = useQuery({ ... });
// isPaused is shorthand for fetchStatus === 'paused'

if (isPaused) {
  return <div className="warning">Waiting for a connection…</div>;
}
```

See [offline and PWA](./offline-and-pwa.md).

## Cheatsheet

| Situation          | `isPending` | `isFetching` | `isStale` | What to show             |
| ------------------ | :---------: | :----------: | :-------: | ------------------------ |
| First visit        |     ✅      |      ✅      |    ✅     | Skeleton / full spinner  |
| Fresh success      |     ❌      |      ❌      |    ❌     | Data                     |
| Background refresh |     ❌      |      ✅      |    ✅     | Data + small indicator   |
| Stale data         |     ❌      |      ❌      |    ✅     | Data + "from cache" hint |
| Offline            |     ❌      | ❌ (paused)  |    ✅     | Data + "you are offline" |

## A word of restraint

Most of the time `opacity: isFetching ? 0.5 : 1`, or a small indicator, is all you need. Do not
burden the user with the internals of your cache unless the domain genuinely calls for it — banking,
trading, anything where acting on stale numbers is expensive.
