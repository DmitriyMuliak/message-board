# State: local, context, or an external store

Three tools, one question behind all of them: **who has to re-render when this value changes?**

Answer that and the choice makes itself.

## `useState` — the default

State belongs in the component that owns it, until proven otherwise. Which child is open, a local
confirm mode, an unsent draft, focus handling.

Lifting it "just in case" is the most common way to make a tree re-render for no reason. Push it down
until something else genuinely needs it.

## Context — for a stable handle, not for a changing value

Context is a **dependency-injection mechanism**, not a state manager. It is the right tool when a
subtree needs access to something, and the wrong tool when that something changes often.

The rule: **the value you put in a provider should be stable.** A theme that changes on a toggle, a
session that is fixed after login, a client instance, a store handle — fine. A value that changes on
every keystroke — every consumer re-renders, whether or not it reads the part that changed.

That failure mode and the way around it are in
[**Context that does not re-render everything**](./context.md).

## An external store — when consumers need slices

When many components read **different parts** of the same changing state, you want each one
subscribed to its own slice, so a change to one field re-renders one component.

That is what `useSyncExternalStore` is for, and what Zustand, Redux and TanStack Query all use
underneath. The mechanics — the observer pattern, why immutability is load-bearing, where the
subscription actually fires — are in
[`tanstack-query/how-it-works.md`](../tanstack-query/how-it-works.md).

## Choosing

| The value…                              | Use                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------- |
| is used by one component                | `useState`                                                                 |
| is used by a subtree and rarely changes | Context                                                                    |
| is used by a subtree and changes often  | Context holding a **store**, plus `useSyncExternalStore`                   |
| comes from the server                   | a query cache — [TanStack Query](../tanstack-query/README.md), not a store |
| should survive a reload or be shareable | **the URL**                                                                |

## Two things worth saying out loud

**Server data is not application state.** Do not copy a response into a store — that is a second
source of truth, and keeping the two in sync is the problem the query cache exists to remove. See
[`tanstack-query/state-and-selectors.md`](../tanstack-query/state-and-selectors.md).

**The URL is a store you already have.** Filters, tabs, pagination, an open detail panel — putting
them in search params makes every view shareable and bookmarkable for free, with no synchronisation
code at all. This repo does exactly that; see
[`architecture/data-layer.md`](../architecture/data-layer.md).

## What this repo actually uses

No Zustand, no Redux, no Jotai. Filters live in the URL, server data in the TanStack Query cache,
arrangement in `useState`, and exactly **two** contexts — the session and the toast queue, both
effectively immutable after mount.

That is the point: most "where should the store live" questions dissolve when there is no store. See
[`fsd-in-practice.md` → Where state lives](../fsd-in-practice.md#3-where-state-lives) for how that
interacts with the layer rules.
