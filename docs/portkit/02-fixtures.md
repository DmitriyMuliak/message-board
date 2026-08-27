# How Vitest fixtures work

A prerequisite for the rest of this folder. If you already write fixtures, skip to
[`03-architecture.md`](./03-architecture.md).

The block being explained is the whole of `reference/features/author-card/testkit/fixtures.ts`:

```ts
export const authorCardFixtures: KitFixtures<AuthorCardFixtures> = {
  authorCardOptions: {},

  authorCard: async ({ authorCardOptions }, provide) => {
    const kit = createAuthorCardKit({ mswServer: server, ...authorCardOptions });
    kit.setup();
    await provide(kit);
    kit.cleanup();
  },
};
```

---

## 1. What it replaces

Without fixtures, every test file that wants a kit looks like this:

```ts
describe('AuthorCard', () => {
  let kit; // 1. untyped until assigned, possibly undefined

  beforeEach(() => {
    // 2. runs for EVERY test in the file
    kit = createAuthorCardKit({ mswServer: server });
    kit.setup();
  });

  afterEach(() => {
    kit.cleanup(); // 3. lives far from the setup it undoes
  });

  it('…', async () => {
    await kit.driver.follow();
  });
});
```

Four defects, and they compound as kits multiply:

1. `let kit` is a mutable binding in the describe scope. TypeScript cannot prove it is assigned.
2. `beforeEach` is unconditional. Ten kits in a file means ten kits built for every test, including
   the test that touches none of them.
3. Setup and teardown are two blocks kept in sync by hand. Delete one, nothing tells you.
4. Ordering between kits is yours to maintain: which `beforeEach` runs first, which `afterEach` last.

---

## 2. What a fixture is

> A **fixture** is a named piece of setup-and-teardown that the runner resolves on demand and injects
> into a test **by parameter name**.

You describe _how to produce a thing and how to dispose of it_; the runner decides _when_, and hands
the result to any test that asks.

`test.extend(...)` takes an object of such recipes and returns a **new `test` function**:

```ts
const test = base.extend(authorCardFixtures);
```

A test asks by destructuring:

```ts
test('following works', async ({ authorCard }) => { … });
//                               ^^^^^^^^^^ this name IS the request
```

The destructuring is not cosmetic — it is the mechanism. Vitest reads which fixtures the test
function names and builds only those.

---

## 3. Line by line

```ts
export const authorCardFixtures: KitFixtures<AuthorCardFixtures> = {
```

An object of recipes. **Not a `test`** — a kit that exported a `test` would bind the runner's entry
point to one component, and two unrelated kits could never appear in the same file. The test file
composes: `base.extend(a).extend(b)`.

```ts
  authorCardOptions: {},
```

A fixture whose recipe is **a plain value**, not a function. It is the override point:

```ts
describe('for a specific author', () => {
  test.scoped({ authorCardOptions: { authorId: 'u_7' } });
  // every test in this describe now gets a kit built with authorId 'u_7',
  // because the `authorCard` fixture depends on this one and is rebuilt
});
```

```ts
  authorCard: async ({ authorCardOptions }, provide) => {
```

Two arguments:

- **the context** — the other fixtures this one depends on. Destructuring `authorCardOptions` here
  is a _declaration of dependency_; Vitest guarantees it is ready first.
- **`provide`** — below.

```ts
const kit = createAuthorCardKit({ mswServer: server, ...authorCardOptions });
kit.setup();
```

Build the kit and install its per-test state: MSW handlers registered, spies armed with a default
scenario, nested child kits set up.

```ts
await provide(kit);
```

Hand `kit` to the test — and **suspend here until that test finishes**.

```ts
    kit.cleanup();
  },
};
```

Everything after the `await` is teardown.

---

## 4. `provide` — the suspension point

The one idea worth slowing down for. Calling `provide` does two things at once:

1. **publishes the value** — what you pass becomes what the test sees as `authorCard`;
2. **pauses your fixture function** — the returned promise does not resolve until the test that used
   the fixture has finished.

So a fixture is not "a function that returns a value". It is a function that runs _around_ the test:

```text
const test = base.extend({...})     ← only defines recipes. Nothing runs yet.
        │
test('…', ({ authorCard }) => …)    ← the destructured name is the request
        │
        ▼
   kit = createAuthorCardKit()     ─┐
   kit.setup()                      │  SETUP — before the test body
        │                           │
   await provide(kit)  ───────────► │  ⏸ fixture pauses; the test body runs,
        │                           │     with `kit` bound to what was provided
        │      « test body »        │
        │                           │
   ◄─────────────────────────────── │  ⏵ the await resolves when the test ends
   kit.cleanup()                   ─┘  TEARDOWN — after the test body
```

That is why there is no `afterEach`: **the code after `await provide(...)` _is_ the `afterEach`**,
written next to the setup it undoes, in the same function, closing over the same `kit`. No `let`, no
reassignment, no way for the two halves to drift.

> **Naming note.** Vitest's docs call this argument `use`. It is positional, so the name is free. Use
> `provide` — `eslint-plugin-react-hooks` reads a bare `use(...)` call as React 19's `use` hook and
> fails `rules-of-hooks` on every fixture you write.

---

## 5. What you get, measured

Verified with this probe (vitest 4.1.10):

```ts
const test = base.extend<{ thing: { id: number } }>({
  thing: async ({}, provide) => {
    const value = { id: ++instances };
    log.push(`setup#${value.id}`);
    await provide(value);
    log.push(`teardown#${value.id}`);
  },
});

test('a', ({ thing }) => log.push(`test-a saw #${thing.id}`));
test('b FAILS on purpose', ({ thing }) => {
  log.push(`test-b saw #${thing.id}`);
  expect(1).toBe(2);
});
test('c does not destructure the fixture', () => log.push('test-c'));
```

```json
["setup#1", "test-a saw #1", "teardown#1", "setup#2", "test-b saw #2", "teardown#2", "test-c"]
```

**Fresh per test.** `#1` then `#2` — no shared mutable state, no leak between tests.

**Teardown runs even when the test fails.** `teardown#2` is present after B's failed assertion. You
get this with `afterEach` too, but here it is guaranteed to be _the teardown paired with that exact
setup_.

**Lazy.** No `setup#3` at all — test C never named the fixture. This is what makes a big kit cheap: a
host kit can own five children, and a narrow test pays only for what it names.

**Dependency order resolved for you.** A fixture that destructures another runs after it and is torn
down before it. You never write `[...children].reverse()`.

---

## 6. The type annotation

```ts
export const authorCardFixtures: KitFixtures<AuthorCardFixtures> = { … };
```

`KitFixtures` (`reference/test-utils/testkit.ts`) mirrors the shape Vitest expects:

```ts
export type KitFixtures<Own, Deps = object> = {
  [K in keyof Own]:
    | Own[K] // a plain value, like `{}`
    | ((
        // …or a recipe function
        context: Omit<Own, K> & Deps & TestContext, // other fixtures (never itself)
        provide: (value: Own[K]) => Promise<void>,
      ) => Promise<void>);
};
```

Two details that matter:

- `Deps` is how a kit declares it needs _another_ kit's fixtures. A test file composing it without
  them fails to compile.
- **Annotating the object is what lets the call site be a bare `.extend(obj)`.** Writing
  `.extend<T>(obj)` instead binds `T` to Vitest 4's scoped-fixture overload — where the type
  parameter is a fixture _name_. The call still runs correctly, but the context type silently loses
  every fixture and `({ authorCard })` stops type-checking.

---

## 7. The ordering caveat

Fixture teardown runs **after** the global `afterEach` in `setup.ts`. Measured:

```text
--global.beforeEach
fixture setup
   « test body »
--global.afterEach      ← cleanup() + server.resetHandlers() + resetNextNavigation()
fixture teardown        ← runs here, LAST
```

By the time `kit.cleanup()` executes, the DOM is unmounted and MSW handlers are already reset. So a
fixture teardown:

- must **not** assert on the DOM — it is gone;
- must **not** assume its MSW handlers still exist — they do not;
- **should** release exactly what it owns: spies (`mockReset()`), its own world, its child kits.

Symmetrically the global `beforeEach` runs _before_ fixture setup, so a fixture's `server.use()`
lands after any globally installed handler — which is the order you want, since a later
`server.use()` wins.
