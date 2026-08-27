# How `useQuery` actually works

`useQuery` is built on `useSyncExternalStore`. That raises a fair question: if the hook runs during
render, when does the fetch happen?

**Short answer: `useSyncExternalStore` does not fetch.** The fetch is still a side effect, triggered
at the same point in the lifecycle where a `useEffect` would run.

## The division of labour

React's rule is strict: **no side effects during the render phase.** `useSyncExternalStore` runs
during render and commit, but its job is to _subscribe_ to an external store and guarantee the UI
does not tear during concurrent rendering.

So the roles split three ways:

1. **`useSyncExternalStore`** — **reading.** "Watch this slice of the cache. If it changes, re-render
   me."
2. **`QueryObserver`** (an internal class) — **the logic.** Decides whether the data is stale and
   whether a request is needed.
3. **An internal effect** — **the request.**

## What happens when you call `useQuery`

Simplified:

1. **Render:** a `QueryObserver` instance is created.
2. **Commit:** React calls `useSyncExternalStore`, which registers the observer with the
   `QueryClient`.
3. **Mount:** with the subscription in place, the observer checks state — "no data, or the data is
   stale".
4. **Fetch:** the observer calls `fetch()`.

That call happens asynchronously, in a microtask — which, from React's point of view, is equivalent
to running inside `useEffect`.

### Why not fetch inside `useSyncExternalStore` directly?

Fetching inside `getSnapshot` would break React: that function must be **pure** and return a value
synchronously.

The `subscribe` function is different — it runs after commit, which is precisely when the component
has mounted. **`subscribe` fires at the same moment `useEffect` (or `useLayoutEffect`) would.** That
is the hook the library uses.

### Conceptually, inside the library

```ts
function useQuery(options) {
  // 1. the brain that owns the logic
  const [observer] = useState(() => new QueryObserver(client, options));

  // 2. subscribe to store updates (to get data, isLoading)
  const result = useSyncExternalStore(
    (onStoreChange) => {
      // this subscribe runs after commit — like useEffect
      const unsubscribe = observer.subscribe(onStoreChange);

      // and here is the trigger: having subscribed, the observer
      // checks whether it needs to fetch, and starts if so
      observer.updateResult();

      return unsubscribe;
    },
    () => observer.getCurrentResult(),
  );

  return result;
}
```

**So:** the subscription mechanism is `useSyncExternalStore`; the moment the fetch starts is a side
effect after mount.

---

## The part people find confusing: you never notify the hook directly

When React calls your `subscribe`, it hands you a **callback** — usually named `onStoreChange` or
`notify`. Your job is to keep that callback and call it when the data changes.

1. **React:** "I want to subscribe. Here is my callback. Call it when something changes."
2. **Your store:** "Noted — callback added to my `listeners` set."
3. **A change happens:** you update state.
4. **Notify:** your store walks `listeners` and calls each one.
5. **React reacts:** it calls `getSnapshot`, sees new data, re-renders.

### Writing that store from scratch — the observer pattern

```ts
const myStore = {
  state: { count: 0 },
  listeners: new Set<() => void>(), // React's callbacks live here

  // read (getSnapshot)
  getState() {
    return myStore.state;
  },

  // subscribe
  subscribe(callback: () => void) {
    myStore.listeners.add(callback);
    return () => myStore.listeners.delete(callback); // cleanup
  },

  // action
  increment() {
    // a NEW object — immutability is what lets React see the difference
    myStore.state = { count: myStore.state.count + 1 };
    myStore.emitChange();
  },

  emitChange() {
    myStore.listeners.forEach((listener) => listener());
  },
};
```

```tsx
import { useSyncExternalStore } from 'react';

export default function Counter() {
  // the hook passes its own internal callback into myStore.subscribe
  const state = useSyncExternalStore(myStore.subscribe, myStore.getState);

  return <button onClick={() => myStore.increment()}>Count: {state.count}</button>;
}
```

### Two things that will bite you

**1. Immutability.** `useSyncExternalStore` compares snapshots with `Object.is`.

```js
// ❌ the object reference did not change
myStore.state.count++;
myStore.emitChange();
```

React will call `getSnapshot`, get _the same object_, compare it to the previous one, see `true`, and
**not re-render** — even though you notified every listener. Return a new object, or a primitive.

**2. Stable function identity.** `subscribe` and `getSnapshot` must not be recreated on every render,
or you get an infinite resubscribe loop. That is why `myStore` lives outside the component.

### Same in Redux and TanStack Query

They do exactly this. Their state is more complex and their listeners are usually batched to avoid
rendering too often, but the shape is identical: **React hands you a remote control, and you press
the button when you are ready.**
