# Rendering

What runs on the server, what ships to the browser, and what keeps both from growing by accident.

---

**RSC is the default; `'use client'` starts where interaction starts.** Route-level splitting is free
in the App Router. Heavy leaves go through `next/dynamic` — a component that pulls in a large library
nobody needs until they open it should cost zero bytes until they do. `next/font` self-hosts, so no
external request and no CLS.

**Pick the strategy per route, from what the route depends on.** A page with no per-request data is
static even if it contains a client island. A page that depends on the session cookie _and_
`searchParams`, and whose payload differs per viewer, is dynamic and streamed — it cannot be cached.
Route handlers behind mutations are uncached, because those have to be read-your-writes. ISR needs a
key space small enough that cache entries are actually shared; per-user × per-filter is not that, and
recognising when ISR does _not_ fit is the useful half of knowing about it.

**Re-render discipline is structural, not `memo()` everywhere.** View state in the URL rather than a
context avoids re-rendering a subtree on every change. React Hook Form keeps inputs uncontrolled, so
typing re-renders the character counter, not the list beside it. The query key _is_ the memo key.
Virtualization caps mounted rows regardless of collection length. When a regression does appear,
reach for the Profiler and "why did this render" before reaching for `memo`.

**Virtualize after mount, not during SSR.** A virtualizer has no viewport rect on the server, so it
renders zero rows and then a burst of overlapping ones on hydration. Render plain flow until mounted
and switch after — one extra pre-paint render, in exchange for correct SSR output.

---

## Keeping the bundle honest

Whether it grew and what grew are different questions, and they need different tools.

- **Did it grow?** [`.size-limit.js`](../../.size-limit.js) measures gzipped `.next/static/**` against a
  budget and fails the build on a regression. It runs in CI after `next build`.
- **What grew?** `pnpm analyze` (`next experimental-analyze`) opens Turbopack's module graph, filtered
  by route, with the import chain that explains why a module is in there. Interactive only, so it
  stays out of CI.

Next 16 removed per-route build stats, which is why the budget covers whole output rather than First
Load JS per route — the reasoning, and the upstream issue, are in the header of
[`.size-limit.js`](../../.size-limit.js).

Caching is a separate axis: which of Next's four caches a given route touches, and what that means
for writes, is in [`caching-and-server-actions.md`](../nextjs/caching-and-server-actions.md).
