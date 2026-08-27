# The data layer

How this codebase fetches, caches, mutates and recovers. Every item is a pattern rather than a
description — none of it depends on the app being a message board. What the feed specifically does
with them is in [`inner/ARCHITECTURE.md`](./inner/ARCHITECTURE.md).

---

**View state lives in the URL, not in React.** Components read `useSearchParams()`; interactions
write `window.history.pushState`. Shareable and bookmarkable come free, because there was never a
second copy to keep in sync. `pushState` rather than `router.push` is the deliberate part: it changes
the URL without re-running the RSC, so a filter chip does not cost a server round-trip. The cost: the
server never learns the URL changed, so anything server-rendered has to be keyed carefully.

**Server data is TanStack Query, hydrated _with its key_.** The RSC prefetches into a per-request
`QueryClient` and ships it via `dehydrate()` + `<HydrationBoundary>`, never `initialData`. Because
dehydrated data carries its query key, a client that asks for a different key simply misses and
fetches — the entire class of "wrong data under the right key" bugs is unrepresentable.

**The prefetch is not awaited.** `shouldDehydrateQuery` is opened up to `pending` queries, so the
server dehydrates the in-flight promise itself: the shell streams immediately and the data slot fills
when it resolves. Measured on this app under 1.2 s of simulated latency: ~100 ms to first paint
instead of ~1.4 s.

**Optimistic mutations follow one shape.** `onMutate` cancels in-flight queries for the key
(otherwise a landing refetch clobbers the write), snapshots the cache, then writes. `onError`
restores the snapshot wholesale rather than trying to undo field by field. `retry: 0` on mutations,
because an auto-retry fires after the rollback and fights it.

**The client generates the entity id.** The server echoes it back, so `onSuccess` swaps the
optimistic row in place — same id, same list key, no remount and no scroll jump — and the POST
becomes idempotent, so a retry cannot double-create. This is worth doing even when the optimistic UI
is not virtualized; it is what makes reconciliation a swap instead of a diff.

**Invalidate broadly, refetch narrowly.** A mutation invalidates the whole key prefix, not just the
key currently on screen: every other cached filter combination still holds the pre-mutation list and
would serve it from cache for `staleTime`. That is nearly free — `invalidateQueries` only _marks_
stale, and with the default `refetchType: 'active'` only the mounted query actually refetches.

**Failures are caught next to the data, not at the route.** `useSuspenseQuery` and
`useSuspenseInfiniteQuery` default to `throwOnError: true`, so a failed fetch never sets
`query.isError` — it throws. Without a boundary around the consuming component it escapes to the
route-level `error.tsx` and replaces the whole page. A local `<ErrorBoundary>` (`shared/ui`, ~40
lines — not worth a dependency) wired to `useQueryErrorResetBoundary` keeps the rest of the page
standing and makes a retry refetch in place. Give it `resetKeys` so a changed input clears a stale
error on its own: a new request means the old failure no longer applies.

**Query defaults are per-resource, not global.** `makeQueryClient` sets only what is genuinely
app-wide (`staleTime`, `retry`, dehydration). Anything resource-specific is registered with
`setQueryDefaults(<keyPrefix>, …)` at the composition root, with the policy owned by the entity the
key belongs to. `placeholderData: keepPreviousData` used to be a global default here, which meant it
also governed an unrelated dropdown's query and every query written since. Worth knowing:
`UseSuspenseInfiniteQueryOptions` _omits_ `placeholderData`, so a query default is the only place it
type-checks — it works at runtime, but on a library inconsistency rather than a contract. The full
case — mechanics, failure modes, and the four correct ways to use the option — is in
[`TSQueryPrevDataGuide.md`](./TSQueryPrevDataGuide.md).

**Cursor pagination, not offset.** Offset breaks under an app's own optimistic writes: insert a row
at the top while the reader is on page 1 and page 2 repeats a row; delete one and page 2 skips one. A
keyset cursor is stable under both. Make it opaque (base64 of the sort key plus a tiebreaker) so the
sort key can change later without breaking a client that decided to parse it.

---

Which write belongs in a server action and which in a route handler, and which of Next's four caches
you are actually talking about, is a separate question:
[`caching-and-server-actions.md`](./caching-and-server-actions.md).
