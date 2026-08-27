# Zustand — a composable store

When [the decision table](./README.md#choosing) lands on "external store", this is the shape to
build. The idea running through all of it: **a store is assembled from small factories, not written
out by hand each time.**

Two things make that possible — slices that only see their own subtree, and behaviours that are
plain functions returning an object you spread in.

---

## 1. The client

One factory, so every store in the app has the same middleware pipeline:

```ts
// store/createStore.ts
import { create, StateCreator } from 'zustand';
import { devtools, DevtoolsOptions } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { envType } from '@/utils/envType';

/**
 * ⚠ Middleware order matters:
 *   immer → devtools  — DevTools shows clean patches
 *   devtools → immer  — DevTools shows raw state, Immer drafts included
 * We use immer → devtools, which is usually what you want.
 */
export const createAppStore = <T>(
  creator: StateCreator<T, [['zustand/immer', never], ['zustand/devtools', never]], []>,
) => create<T>()(immer(devtools(creator, devtoolsOptions)));

const devtoolsOptions: DevtoolsOptions = {
  enabled: envType.isDev,
  name: 'RootStore',
};
```

`immer` is what lets every method below be written as a mutation (`arr.push(value)`) while the store
stays immutable underneath — which is the requirement `useSyncExternalStore` imposes. See
[the immutability note in `context.md`](./context.md#two-things-that-will-break-it).

## 2. Typing the pipeline once

Every slice creator needs to declare the same middleware tuple. Name it once:

```ts
// store/sliceCreator/types.ts
import { StateCreator } from 'zustand';
import { RootStore } from '../types';

type Middlewares = [['zustand/immer', never], ['zustand/devtools', never]];

export type SliceCreator<Parent, Slice> = StateCreator<Parent, Middlewares, [], Slice>;
export type RootSlice<Slice> = StateCreator<RootStore, Middlewares, [], Slice>;
```

## 3. `sliceCreator` — a slice that cannot reach the root

This is the load-bearing piece. Zustand hands every slice the **root** `set` and `get`, which means
any slice can write anywhere. `sliceCreator` scopes them to one key:

```ts
// store/sliceCreator/index.ts
export function sliceCreator<State, K extends keyof State>(
  key: K,
  def: SliceDefinition<State, K>,
): SliceWrapperDefinition<State, K> {
  return (set, get, api) => {
    const sliceSet = (fn: (slice: Draft<State[K]>) => void) => {
      set((state) => {
        // TS cannot index Draft<State> with a generic K, so we assert that the
        // state has the indexed property and that it is a Draft<State[K]>.
        // The cast is local, and documents the invariant we rely on.
        const sub = (state as unknown as { [P in K]: Draft<State[P]> })[key];
        fn(sub);
      });
    };

    const sliceGet = () => get()[key];

    return def(sliceSet, sliceGet, api);
  };
}
```

Inside a slice, `set` and `get` now mean _this slice_:

```ts
const createInnerEntitySlice = sliceCreator<EntitySlice['topEntitySlice'], 'innerEntitySlice'>(
  'innerEntitySlice',
  (set, _get, _api) => ({
    innerEntitySlice: {
      innerValue: false,
      ...createSetter(set),
    },
  }),
);
```

The `api` argument is deliberately **not** scoped — it stays global, so a slice that genuinely needs
to read another one still can, but has to say so explicitly.

---

## 4. Composition — the point of all this

A behaviour is a function that takes `set` and returns an object. You spread it in.

```ts
// store/utils/setValue.ts
export const createSetter = <T extends object>(set: ImmerSet<T>) => {
  const setValue = <K extends keyof T>(key: K, value: T[K]) => {
    set((state) => {
      (state as unknown as T)[key] = value;
    });
  };
  return { setValue };
};

export const createPatcher = <T extends object>(set: ImmerSet<T>) => {
  const setPatch = (patch: Partial<T>) => {
    set((state) => {
      const draft = state as unknown as T;
      for (const key in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          const k = key as keyof T;
          draft[k] = patch[k] as T[typeof k];
        }
      }
    });
  };
  return { setPatch };
};

// escape hatch: run an arbitrary recipe against this slice's set
export const createInlineSetter = <T extends object>(set: ImmerSet<T>) => ({
  setter: (cb: (set: ImmerSet<T>) => void) => cb(set),
});
```

And a slice becomes a list of the behaviours it has, plus whatever is genuinely its own:

```ts
export const createEntitySlice = sliceCreator<RootStore, 'topEntitySlice'>(
  'topEntitySlice',
  (set, get, api) => ({
    topEntitySlice: {
      isBrandCool: false,
      someInnerObject: { name: '', age: 30 },

      userList: createListSlice<SomeObj, RootStore['topEntitySlice'], 'userList'>('userList', {})(
        set,
        get,
        api,
      ).list,

      ...createInnerEntitySlice(set, get, api), // a nested slice
      ...createInlineSetter(set),
      ...createPatcher(set),
      ...createSetter(set),
    },
  }),
);
```

Read that top to bottom and you can see what the slice can do without reading a single method body.
That is the return on this design.

---

## 5. The list case

**The problem.** You have ten stores with a list in them. Each one grows its own `add`, `remove`,
`clear`, `reorder` — ten near-identical implementations of `Array.prototype.push`, each with its own
chance of a bug, none of them tested.

A list is a list. Write the behaviour once.

### A minimal list slice

```ts
// store/utils/list.ts
export interface ListSlice<T> {
  arr: T[];

  // positional
  push: (value: T) => void;
  pop: () => void;
  unshift: (value: T) => void;
  shift: () => void;
  reverse: () => void;

  // wholesale
  set: (values: T[]) => void;
  clear: () => void;
}

interface CreateListSliceOptions<T> {
  defaultValue?: T[];
}

export const createListSlice = <T, State extends Record<K, ListSlice<T>>, K extends keyof State>(
  entityKey: K,
  options: CreateListSliceOptions<T> = {},
) => {
  return (set: SliceSet<State>, _get: SliceGet<State>, _api: SliceApi) => ({
    list: {
      arr: options.defaultValue ?? [],

      push: (value: T) => set((s) => void s[entityKey].arr.push(value)),
      pop: () => set((s) => void s[entityKey].arr.pop()),
      unshift: (value: T) => set((s) => void s[entityKey].arr.unshift(value)),
      shift: () => set((s) => void s[entityKey].arr.shift()),
      reverse: () => set((s) => void s[entityKey].arr.reverse()),

      set: (values: T[]) => set((s) => void (s[entityKey].arr = values)),
      clear: () => set((s) => void (s[entityKey].arr = [])),
    } as unknown as State[K],
  });
};
```

Every method is one line, because Immer lets us call the native array method directly. There is no
logic to get wrong.

### Adding identity — `add(id)`, `remove(id)`

Positional operations are enough for a plain array. The moment items have ids, you want the other
half — and it is the same factory with one extra constraint:

```ts
export interface EntityListSlice<T extends { id: string }> extends ListSlice<T> {
  add: (item: T) => void; // append, or replace if the id already exists
  remove: (id: string) => void;
  update: (id: string, patch: Partial<T>) => void;
  toggle: (item: T) => void; // present → remove, absent → add
  moveTo: (id: string, index: number) => void;
}

export const createEntityListSlice = <
  T extends { id: string },
  State extends Record<K, EntityListSlice<T>>,
  K extends keyof State,
>(
  entityKey: K,
  options: CreateListSliceOptions<T> = {},
) => {
  const base = createListSlice<T, State, K>(entityKey, options);

  return (set: SliceSet<State>, get: SliceGet<State>, api: SliceApi) => {
    const at = (s: State) => s[entityKey].arr;

    return {
      list: {
        ...base(set, get, api).list,

        add: (item: T) =>
          set((s) => {
            const i = at(s).findIndex((x) => x.id === item.id);
            if (i === -1) at(s).push(item);
            else at(s)[i] = item;
          }),

        remove: (id: string) =>
          set((s) => {
            const i = at(s).findIndex((x) => x.id === id);
            if (i !== -1) at(s).splice(i, 1);
          }),

        update: (id: string, patch: Partial<T>) =>
          set((s) => {
            const item = at(s).find((x) => x.id === id);
            if (item) Object.assign(item, patch);
          }),

        toggle: (item: T) =>
          set((s) => {
            const i = at(s).findIndex((x) => x.id === item.id);
            if (i === -1) at(s).push(item);
            else at(s).splice(i, 1);
          }),

        moveTo: (id: string, index: number) =>
          set((s) => {
            const i = at(s).findIndex((x) => x.id === id);
            if (i === -1) return;
            const [item] = at(s).splice(i, 1);
            at(s).splice(index, 0, item);
          }),
      } as unknown as State[K],
    };
  };
};
```

`createEntityListSlice` **composes** `createListSlice` rather than restating it — the positional
methods come from the spread, the id-aware ones are added on top. That is the same move as spreading
`createSetter` into a slice, one level up.

### Using it

```ts
export interface EntitySlice {
  topEntitySlice: {
    userList: EntityListSlice<User>;
    tags: ListSlice<string>;
  };
}

// in the slice
userList: createEntityListSlice<User, RootStore['topEntitySlice'], 'userList'>('userList', {})(
  set, get, api,
).list,

tags: createListSlice<string, RootStore['topEntitySlice'], 'tags'>('tags', {
  defaultValue: [],
})(set, get, api).list,
```

```tsx
const push = useAppStore((s) => s.topEntitySlice.tags.push);
const removeUser = useAppStore((s) => s.topEntitySlice.userList.remove);

push('urgent');
removeUser('u_42');
```

Two lists, two different element types, zero hand-written methods.

### Where to stop

Do not push domain logic into the factory. `add`, `remove`, `reverse` are list operations —
`promoteToAdmin` is not, even if it happens to be implemented as an array update. The moment a method
needs to know what `T` _means_, it belongs in the slice.

---

## 6. Async with cancellation — `createFlow`

The same factory idea applied to an async action. It owns an `AbortController`, so the caller gets
`run` and `cancel` instead of writing that plumbing per action:

```ts
// store/utils/flow.ts
export function createFlow<TArgs extends any[], TResult>(
  handler: (signal: AbortSignal, ...args: TArgs) => Promise<TResult>,
) {
  return () => {
    const controller = new AbortController();
    let isRunning = false;

    async function run(...args: TArgs): Promise<TResult> {
      isRunning = true;
      try {
        return await handler(controller.signal, ...args);
      } finally {
        isRunning = false;
      }
    }

    function cancel() {
      if (isRunning) controller.abort();
    }

    return { run, cancel, controller };
  };
}
```

```ts
interface UserState {
  user: null | { id: string; name: string };
  loadUser: ReturnType<typeof createFlow<[string], { id: string; name: string }>>;
}

const useUserStore = create<UserState>(() => ({
  user: null,
  loadUser: createFlow(async (signal, userId: string) => {
    const res = await fetch(`/api/user/${userId}`, { signal });
    return res.json();
  })(),
}));
```

> **One caveat worth knowing:** an `AbortController` cannot be reused — once aborted it stays
> aborted, so a `cancel()` followed by a `run()` starts a request that is already cancelled. If a flow
> needs to run more than once after a cancellation, create the controller **inside** `run` rather than
> in the closure.
>
> And if the handler is a Server Action rather than a fetch, the signal does not cross the boundary at
> all — see [cancelling a Server Action](../nextjs/aborting-server-actions.md).

---

## 7. Two store shapes

Not everything needs the slice machinery.

**One root store, composed of slices** — for state that several features share and that DevTools
should show as one tree:

```ts
// store/index.ts
export const useAppStore = createAppStore<RootStore>((set, get, api) => ({
  ...createEntitySlice(set, get, api),
}));
```

**A standalone store** — for something small and self-contained:

```ts
// store/stores/useAuthStore.ts
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
}));
```

Reach for the root store when slices need to be inspected together or a slice needs `api` access to
another. Otherwise a standalone store is less machinery and easier to delete.

---

## 8. Always subscribe with a selector

This is the part that decides whether the store is fast.

```tsx
// ❌ subscribes to the entire store — re-renders on any change anywhere
const store = useAppStore();

// ✅ subscribes to one value
const isBrandCool = useAppStore((s) => s.topEntitySlice.isBrandCool);

// ✅ actions are stable references — selecting one never causes a re-render
const push = useAppStore((s) => s.topEntitySlice.tags.push);
```

Selecting a **derived object** rebuilds it on every call, so the equality check always fails and you
re-render every time — the same trap as
[a non-primitive snapshot](./context.md#two-things-that-will-break-it):

```tsx
// ❌ new object each call
const { name, age } = useAppStore((s) => ({
  name: s.topEntitySlice.someInnerObject.name,
  age: s.topEntitySlice.someInnerObject.age,
}));

// ✅ two subscriptions, each to a primitive
const name = useAppStore((s) => s.topEntitySlice.someInnerObject.name);
const age = useAppStore((s) => s.topEntitySlice.someInnerObject.age);

// ✅ or one subscription with an explicit comparator
import { useShallow } from 'zustand/react/shallow';
const { name, age } = useAppStore(useShallow((s) => s.topEntitySlice.someInnerObject));
```

Zustand is `useSyncExternalStore` underneath, so everything in
[`context.md`](./context.md) about snapshots applies here unchanged.

---

## 9. A typing wall you will hit

`createListSlice` takes three type parameters and only the last one could be inferred — but
TypeScript is all-or-nothing: specify one and you must specify them all. That is
**partial type argument inference** ([TS#26242](https://github.com/microsoft/TypeScript/issues/26242)),
which is why the call site reads:

```ts
createListSlice<SomeObj, RootStore['topEntitySlice'], 'userList'>('userList', {});
```

rather than letting `'userList'` infer itself. The workaround is currying — split the call so each
stage infers what it can:

```ts
export const createListSliceCurried =
  <T, State>() =>
  <K extends keyof State>(entityKey: K, options: CreateListSliceOptions<T> = {}) => {
    /* … */
  };

// K infers from the argument
createListSliceCurried<SomeObj, RootStore['topEntitySlice']>()('userList', {});
```

Whether the `()()` is worth it is a taste call. The other options, and when each is right, are in
[`typescript/tips.md` → partial type argument inference](../typescript/tips.md#3-partial-type-argument-inference).

---

## What this repo does

Nothing of the above — there is no Zustand here. Filters live in the URL, server data in the
TanStack Query cache, and the only two contexts are the session and the toast queue. This page is the
shape to build **if** the decision table sends you here; it is not a recommendation to start.

Related: [Local, context, or a store](./README.md) ·
[Context that does not re-render everything](./context.md) ·
[What a store is still for, next to a query cache](../tanstack-query/state-and-selectors.md)
