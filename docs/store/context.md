# Context that does not re-render everything

Context is a dependency-injection mechanism. Put a **changing value** in it and every consumer
re-renders on every change, whether or not it reads the part that changed. Put a **stable handle** in
it and you can have a subtree share state while each component re-renders only for its own slice.

This is the architecture React Hook Form, Zustand and TanStack Query all use. A form is the clearest
example, so that is the one below.

## The trap

```tsx
// ❌ every keystroke produces a new context value
<FormContext.Provider value={{ state, setState }}>
```

```
email changed
     ↓
new context value
     ↓
ALL consumers re-render
```

Two hundred inputs, one letter typed, two hundred re-renders. Memoising the provider value does not
help — `state` really did change, so the reference really is new. The problem is not the reference;
it is that **the value itself lives in context**.

## The pattern

Context carries a **store**, created once. The store owns the state and the subscriptions. Components
subscribe to a slice through `useSyncExternalStore`.

```tsx
import { createContext, useContext, useState, useSyncExternalStore } from 'react';

type FormState = {
  email: string;
  name: string;
};

function createFormStore(initialState: FormState) {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,

    setState: (patch: Partial<FormState>) => {
      // a NEW object — see the immutability note below
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener());
    },

    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

type FormStore = ReturnType<typeof createFormStore>;

const FormContext = createContext<FormStore | null>(null);

function FormProvider({ children }: { children: React.ReactNode }) {
  // created once, never replaced → the context value is stable forever
  const [store] = useState(() => createFormStore({ email: '', name: '' }));

  return <FormContext.Provider value={store}>{children}</FormContext.Provider>;
}
```

The subscription hook — one field at a time:

```tsx
function useFormField<K extends keyof FormState>(field: K) {
  const store = useContext(FormContext);
  if (!store) throw new Error('useFormField must be used inside FormProvider');

  return useSyncExternalStore(store.subscribe, () => store.getState()[field]);
}
```

And the fields:

```tsx
function EmailInput() {
  const store = useContext(FormContext)!;
  const email = useFormField('email');

  return <input value={email} onChange={(e) => store.setState({ email: e.target.value })} />;
}

function NameInput() {
  const name = useFormField('name');
  console.log('Name render'); // never logs while you type in email
  return <input value={name} />;
}
```

## What happens on a keystroke

```
FormProvider
     │
┌────▼────────┐
│  FormStore  │  ← state + subscriptions
└────┬────────┘
     │
  useSyncExternalStore
   ┌─┴──┐
   ▼    ▼
 email  name
 input  input
```

```
setState({ email })
     ↓
store notifies every listener
     ↓
each useFormField re-runs its snapshot function
     ↓
email: snapshot changed  → EmailInput re-renders
name:  snapshot same     → NameInput does not
```

The context value never changed, so nothing re-rendered because of context. React compares each
snapshot with `Object.is` and re-renders only where the result differs.

## Two things that will break it

**1. Return a new object from `setState`, always.** `useSyncExternalStore` compares snapshots by
identity:

```ts
// ❌ mutating in place — the reference is unchanged
state.email = value;
listeners.forEach((l) => l());
```

Every listener fires, React calls each snapshot function, sees the same object, and re-renders
nothing.

**2. Keep the snapshot a primitive, or memoise it.** The example returns
`store.getState()[field]` — a string, so identity comparison works. Return a derived **object** and
you build a new one on every call, `Object.is` is always false, and you get an infinite render loop:

```ts
// ❌ new object each time getSnapshot runs
() => ({ email: store.getState().email, valid: isValid(store.getState()) });
```

For that, use `useSyncExternalStoreWithSelector` from `use-sync-external-store/shim/with-selector`,
which takes an equality function.

The general mechanics — the observer pattern, why `subscribe` must be stable, where the callback
comes from — are in [`tanstack-query/how-it-works.md`](../tanstack-query/how-it-works.md).

## "Should I wrap `onChange` in `useCallback`?"

No. There is nothing here to optimise about the arrow function, and I would not add `useCallback` for
this `onChange`.

The key point: creating a new function

```tsx
(e) => store.setState({ email: e.target.value });
```

**does not, by itself, cause a re-render.** A re-render comes from a change in state, props or
context, or from a parent re-rendering. A fresh closure costs one allocation, which is nothing.

### When `useCallback` genuinely helps

When something **compares** the identity. Say you have:

```tsx
const handleChange = useCallback(
  (e: ChangeEvent<HTMLInputElement>) => {
    store.setState({ email: e.target.value });
  },
  [store],
);

return <ExpensiveInput onChange={handleChange} />;
```

and `ExpensiveInput` is memoised:

```tsx
const ExpensiveInput = memo(function ExpensiveInput(props) {
  // …
});
```

Here `useCallback` earns its place, because `memo` compares props by reference. Without it:

```tsx
<ExpensiveInput onChange={() => ...} />
```

every parent re-render produces a new function → `memo` sees a new `onChange` → it re-renders anyway,
and the memo has bought you nothing.

One condition that is easy to miss: this works **because `store` never changes**. Put something in
the dependency array that changes every render and `useCallback` hands back a new function each time
— you have added bookkeeping and gained nothing.

### But in this architecture, something more interesting is going on

```tsx
function EmailInput() {
  const store = useContext(FormContext)!;
  const email = useFormField('email');

  return <input value={email} onChange={(e) => store.setState({ email: e.target.value })} />;
}
```

When `email` changes:

```
setState()
   ↓
store notifies subscribers
   ↓
useFormField('email')
   ↓
EmailInput re-renders
```

`NameInput`, subscribed through `useFormField('name')`, does **not** re-render — its snapshot did not
change.

And that matters far more than whether a new arrow function was allocated.

### Where this would actually become critical

Suppose you have:

```
Form
 ├── 1000 EmailInput
 ├── 500  Select
 ├── 300  DatePicker
 └── 200  expensive custom components
```

and every `onChange` allocates new functions — that is almost certainly not your bottleneck.

Now do this instead:

```tsx
<FormContext.Provider value={{ state, setState }}>
```

with `state` changing on every keystroke:

```
email changed
     ↓
new context value
     ↓
ALL context consumers re-render
     ↓
💀
```

_That_ is a real problem. It is [the trap from the top of this page](#the-trap) — and it is the
contrast that makes the point.

### The way to remember it

> Do not optimise the creation of a function. Optimise the number of components that receive the
> signal to re-render.

`useCallback` is a tool for **stabilising a reference** — mostly when that matters to `memo`, to a
dependency array, or to another reference-based optimisation.

In this form-store approach the main optimisation is the granular subscription through
`useSyncExternalStore`, not `useCallback`. Get the subscription right and the closures stop
mattering; get it wrong and no amount of `useCallback` will save you.

## When to reach for this

Not by default. A form with five fields is fine with plain `useState`, or with React Hook Form, which
already does all of the above internally.

This pattern earns its complexity when:

- many components read **different slices** of the same frequently-changing state, and
- the state genuinely must be shared across a subtree rather than lifted one level.

If either is untrue, you are writing a state manager you did not need — see
[the decision table](./README.md#choosing).
