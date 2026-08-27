# Offline and PWA

In an ordinary React app the cache lives in RAM. Close the PWA, reopen it on a plane, and you get a
white screen. TanStack Query has adapters that fix exactly that — and it solves the hardest PWA
problem, data synchronisation, on the way.

Three pillars.

## 1. Persistence — putting the cache on disk

The killer feature. The library can flush its cache — all of it, or a slice — into `localStorage` or
IndexedDB, and read it back on start.

Offline launch then looks like this:

1. App starts.
2. React Query sees there is no network.
3. It reads the previous session's data out of IndexedDB.
4. **The user sees content immediately.**
5. When connectivity returns, it refetches in the background.

```ts
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';

// A long staleTime matters here — offline data should not be considered stale
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 24, // fresh for a day
      gcTime: 1000 * 60 * 60 * 24 * 7, // kept for a week
    },
  },
});

// IndexedDB (via idb-keyval) is the better store for a PWA;
// localStorage is simpler to start with
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  throttleTime: 2000, // write at most every 2s
});

export default function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <YourApp />
    </PersistQueryClientProvider>
  );
}
```

`gcTime` is the one people get wrong: it must be **long**, or the cache is garbage-collected out from
under the user while they are offline.

## 2. Network mode

By default, with no network, React Query **pauses** requests. In a PWA you often want them to fail
fast instead, so the UI can fall back to cached content rather than hanging:

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      // if there is cache, serve it; if not and we are offline,
      // error out rather than waiting forever
      networkMode: 'offlineFirst',
    },
  },
});
```

## 3. Automatic resynchronisation

Out of the box, React Query listens to browser events:

- `online` → refetch every active query.
- `visibilitychange` → refresh when the user comes back to the app.

For a PWA that means "user left the metro, 4G came back, refresh the feed" needs **no code at all**.

---

## Service Worker vs React Query — they are not competitors

The usual confusion. They cache different things at different levels.

A Service Worker sits **between** your React code and the network. When you call `fetch('/api/user')`
it intercepts the request and decides whether to go to the network or answer from the Cache API. Your
React code never learns the network was down — it just receives a `Response`.

|                  | Service Worker                                    | TanStack Query                                 |
| ---------------- | ------------------------------------------------- | ---------------------------------------------- |
| **Stores**       | the whole `Response` (body blob, headers, status) | parsed JSON plus metadata                      |
| **Where**        | Cache API                                         | RAM → IndexedDB / localStorage via a persister |
| **Granularity**  | a URL (`/api/users`)                              | a query key (`['users', { id: 1 }]`)           |
| **Invalidation** | hard — delete the whole entry                     | `invalidateQueries`, partial updates           |
| **UI state**     | none; you handle loading and errors yourself      | `isPending`, `isFetching`, `isRefetching`      |

### Why not just cache API responses in the Service Worker?

Because it is a _dumb_ network cache. Concretely:

1. User opens the PWA offline → the SW serves the stale `/users` list.
2. User adds someone (a POST queued via Background Sync).
3. The cached `/users` entry is still stale. To fix it you must reach into the Cache API, read the
   stream, parse the JSON, append, repackage it as a `Response`, and put it back. That is low-level
   misery.

With React Query you write an optimistic update and the library maintains both the in-memory JSON and
the persisted copy.

### The three cache levels, for completeness

HTTP headers are a _third_ layer, not the same as either of the above:

1. **React Query cache** — in memory / IndexedDB. Fastest, knows your React logic.
2. **Service Worker cache** — a programmable proxy, intercepts requests React Query decides to make.
3. **Browser disk cache** (`Cache-Control`, `ETag`) — automatic, applies if the SW goes to the
   network.

### The split that works

- **Workbox / Service Worker** → the app shell: `index.html`, `main.js`, CSS, fonts, logos. This is
  what lets the app **start** without network.
- **TanStack Query + persister** → API data. This is what lets the app **show something** without
  network, and update it cleanly when the network returns.

---

## How the Service Worker knows what changed

You do not diff files by hand. Content hashing plus Workbox does it at build time.

**1. Hashes in filenames.** Your bundler emits names derived from content:

```
main.js      → main.a1b2c3d4.js
scriptB.js   → scriptB.x9y8z7.js
```

Change only `main.js` and rebuild: `main` gets a new hash, `scriptB` keeps the old one.

**2. A precache manifest** is generated and injected into `sw.js`:

```js
self.__WB_MANIFEST = [
  { url: '/main.f5g6h7j8.js', revision: 'f5g6h7j8' }, // new → will be fetched
  { url: '/scriptB.x9y8z7.js', revision: 'x9y8z7' }, // unchanged → reused
  { url: '/index.html', revision: 'v2' },
];
```

**3. The update lifecycle:**

1. **Check** — the browser sees `sw.js` itself changed (the manifest inside it changed) and starts an
   update.
2. **Install** — the new worker runs alongside the old one, compares the manifest against Cache
   Storage, and downloads **only the delta**.
3. **Waiting** — it waits until every tab is closed, or until you programmatically tell it to take
   over, so the running session is not broken mid-flight.
4. **Activate** — it takes control and cleans up: old `main.a1b2c3d4.js` is deleted because it is no
   longer in the manifest; `scriptB` is untouched.

### Setting it up

Do not write this by hand.

**Vite** — `vite-plugin-pwa` (Workbox underneath):

```js
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate', // or 'prompt' to show an Update button
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
    }),
  ],
});
```

**Next.js** — `@ducanh2912/next-pwa` (the original `next-pwa` is unmaintained):

```js
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
});

module.exports = withPWA({/* config */});
```

---

## The opposite: turning caching off

Occasionally you need a query that leaves nothing behind. Two options do it together:

```ts
const { data } = useQuery({
  queryKey: ['secure-data'],
  queryFn: () => apiService.get('/secure/data'),

  gcTime: 0, // drop from memory the moment the last consumer unmounts
  staleTime: 0, // always considered stale
  refetchOnMount: 'always', // never show a leftover value
});
```

- **`gcTime: 0`** is the real switch. By default data sits in memory for 5 minutes after the last
  component unmounts, so returning to the page is instant. At `0` it is deleted immediately — come
  back a millisecond later and you get a fresh request and `isLoading: true`.
- **`staleTime: 0`** guarantees it is never treated as fresh.

**When this is actually justified** — it is a bad idea 99% of the time, since you are giving up the
speed the library exists for:

1. **Secrets** — a one-time payment token, a decrypted key that should not linger in browser memory.
2. **Very dynamic data** — a transaction status where showing "Pending" for even a moment is
   dangerous.
3. **Debugging** — when you are working on the backend and the frontend not re-requesting is in your
   way.

And if you want none of the library's features for that one call, the simplest answer is often the
right one:

```ts
useEffect(() => {
  apiService.get('/data').then(setData);
}, []);
```

Use the `gcTime: 0` combination only when you still want the loading and error states.

---

Related: [Fetch on mount](./fetch-on-mount.md) · [Polling](./polling.md)
