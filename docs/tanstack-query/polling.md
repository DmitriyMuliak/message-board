# Polling

Three shapes, from the blunt one to the one you actually want for "wait until the job finishes".

## 1. Basic polling — constant interval

The simplest form: repeat the request every N milliseconds.

```ts
const { data } = useQuery({
  queryKey: ['/notifications'],
  queryFn: () => apiService.get('/notifications'),
  // fire every 2 seconds
  refetchInterval: 2000,
});
```

**The architectural detail worth knowing (smart polling).** React Query is not naive about this: if
the user switches browser tab and the window loses focus, **polling stops automatically** to save
bandwidth and battery. It resumes the moment they come back.

## 2. Background polling

If you genuinely must keep asking the server while the tab is hidden — a music player, tracking a
process the user is waiting on — opt in explicitly:

```ts
useQuery({
  queryKey: ['/process-status'],
  queryFn: checkStatus,
  refetchInterval: 2000,
  // keep going even when the tab is not active
  refetchIntervalInBackground: true,
});
```

## 3. Dynamic polling — the one you usually want

This is the best-practice shape for "wait until the export finishes". You do not want to poll
forever; you want to poll until the status becomes `completed` or `failed`, and then stop.

`refetchInterval` accepts a **function** returning either a number or `false` to stop:

```ts
const { data } = useQuery({
  queryKey: ['/export', id],
  queryFn: () => apiService.get(`/export/${id}`),

  // Poll every second while the status is still in progress.
  // As soon as it settles, stop by returning false.
  refetchInterval: (query) => {
    const status = query.state.data?.status;

    if (status === 'completed' || status === 'failed') {
      return false; // stop
    }

    return 1000; // keep going, every 1000 ms
  },
});
```

## Why this beats `setInterval` in a `useEffect`

1. **Deduplication and overlap protection.** With a 1-second interval against a server that answers
   in 3 seconds, a plain `setInterval` builds a train of overlapping requests that piles onto the
   network. React Query **guarantees** the next request starts only _after_ the previous one
   finishes, plus the interval.
2. **Automatic pause.** Resources are not spent while the tab is unfocused — out of the box.
3. **Error handling.** If the server starts returning 500s, React Query can back off exponentially or
   stop polling entirely, depending on `retry`, instead of hammering a server that is already down.
