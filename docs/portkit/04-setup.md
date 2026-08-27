# Bootstrapping a repository

What has to exist before the first kit. Nothing here is specific to PortKit except §4 and §5 — the
rest is the ordinary Vitest + RTL + MSW floor that the architecture guide assumes.

Working files: [`reference/test-utils/`](./reference/test-utils/).

Path convention. Inside [`reference/`](./reference/) the rule is simply **`@/` = `reference/`**, so
every import in the reference code resolves against the tree itself:

| Import specifier | Resolves to              | In your repo                                     |
| ---------------- | ------------------------ | ------------------------------------------------ |
| `@/features/…`   | `reference/features/…`   | your feature code                                |
| `@/test-utils/…` | `reference/test-utils/…` | shared test infrastructure, wherever you keep it |
| `@/shared/ui/…`  | — **not in the tree**    | your design-system components                    |
| `@/server/…`     | — **not in the tree**    | your server-side services                        |

The last two are deliberately absent: they are your code, and nothing about this approach depends on
what is in them. Every other import resolves to a real file you can open.

---

## 1. Dependencies

```bash
pnpm add -D vitest @vitest/coverage-v8 jsdom \
            @testing-library/react @testing-library/user-event @testing-library/jest-dom \
            msw vite-tsconfig-paths
```

Versions this was measured on: **vitest 4.1.10, vite 8.1.4, msw 2.15.0, React 19.2.4, jsdom**. The
fixture semantics in [`02-fixtures.md`](./02-fixtures.md) are Vitest ≥ 1; `test.scoped` needs ≥ 2.

If your drivers assert accessible descriptions, add `dom-accessibility-api` explicitly and pin the
range `jest-dom` uses (`^0.6.3`). As a transitive dep it does not resolve from the project root under
pnpm or Yarn PnP, and a version split makes `state.description` and
`toHaveAccessibleDescription` disagree about the same element.

---

## 2. `vitest.config.ts`

Full file: [`reference/vitest.config.ts`](./reference/vitest.config.ts). Three things
matter.

**`setupFiles`** points at the global lifecycle (§3).

**`resolve.alias` is the Ambient transport.** An alias, not a per-file `vi.mock`, because `vi.mock`
is hoisted and file-scoped and cannot be declared once for every suite. The alias makes `src` and the
test resolve the **same module instance**, so `router.push` in an assertion is literally the spy the
component called.

> **Rule: alias for bare/vendor specifiers; a port for anything the application owns.** An alias
> matches the import _string_. `@/features/x/api/y` in a test and `../api/y` in the component do not
> match, so you silently get two live module instances and an assertion that reads
> `expected "vi.fn()" to be called 1 times, but got 0 times` — while you debug a component whose mock
> was never in the graph.

**`isolate: true`** (the default) is load-bearing: one module graph per test _file_, so the ambient
spies are never shared across files running in parallel. `isolate: false`,
`poolOptions.*.singleFork`, or `it.concurrent` each break that and would require a per-test router
factory instead.

---

## 3. The global lifecycle

[`reference/test-utils/setup.ts`](./reference/test-utils/setup.ts):

```ts
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetNextNavigation();
});

afterAll(() => server.close());
```

The MSW server ([`msw-server.ts`](./reference/test-utils/msw-server.ts)) starts with **no handlers**. Kits
install their own in `setup()`; registering handlers globally would give every suite a world it never
asked for.

### The ordering trap

**Measured: this `afterEach` runs BEFORE fixture teardown.**

```text
--global.beforeEach
fixture setup
   « test body »
--global.afterEach      ← DOM unmounted, MSW handlers reset
fixture teardown        ← runs LAST
```

So a kit's `cleanup()` must not assert on the DOM and must not assume its handlers still exist. It
releases what it owns: spies, its world, its children.

`onUnhandledRequest: 'warn'` is a deliberate choice — it degrades an un-installed endpoint to a
warning plus a real network attempt. The symptom is a slow, confusing test rather than a loud
failure, so if a widget starts fetching and nothing was installed, check `setup()` ran.

---

## 4. `customRender` and the provider boundary

[`reference/test-utils/customRender.tsx`](./reference/test-utils/customRender.tsx) wraps every render in
`TestRootProviders`.

> **Root providers are app-wide infrastructure only** — a QueryClient, a toast host, a theme.

Feature ports are deliberately **absent** from it. A kit mounts its own port through `wrap()`, which
is what keeps one feature's test from silently depending on another feature's wiring — and is the
test-side mirror of "the app root mounts nothing" from
[`03-architecture.md`](./03-architecture.md) §2.

A fresh QueryClient per render with `retry: false` keeps tests isolated and stops a deliberately
failing query from burning the timeout on retries.

---

## 5. The `KitFixtures` helper and the lint boundary

Copy [`reference/test-utils/testkit.ts`](./reference/test-utils/testkit.ts) verbatim. It is one type, and it is
what lets every kit's fixtures object be annotated so the call site can be a bare `.extend(obj)`.
See [`02-fixtures.md`](./02-fixtures.md) §6 for why the explicit generic is wrong.

Kits live under `src/**/testkit/` and import `vitest`. They are never bundled unless app code imports
them — nothing stops someone doing that by accident, so fence it:

```js
// eslint.config.js
{
  files: ['src/**/*.{ts,tsx}'],
  ignores: ['src/**/testkit/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/testkit', '**/testkit/**'],
        message: 'Test kits must not be imported by app code.',
      }],
    }],
  },
}
```

If you would rather not take that risk yet, keeping kits under `tests/` costs nothing today and
changes none of the mechanics — only the import specifier.

---

## 6. Verification: the first kit works

A kit is wired correctly when all four hold:

1. **The test file imports nothing from the feature's `api/`.** No action module, no route constant.
   This is the checkable outcome of the whole approach.
2. **The component called your spy** — render, drive, then
   `expect(kit.actions.follow).toHaveBeenCalled()`. This is the _only_ honest canary. Asserting
   `vi.isMockFunction(...)` passes even when the component is bound to a different module instance.
3. **A scenario set before `render()` changes what the component sees.** If it does not, the world is
   being read at registration time instead of request time.
4. **Removing the provider throws.** `useAuthorPort must be called within an AuthorPortProvider` at
   render is the wiring guard doing its job.

---

## 7. Where the pieces end up

```text
<repo root>/
├── vitest.config.ts           ← aliases, isolate, setupFiles
├── test-utils/
│   ├── setup.ts               ← global lifecycle (setupFiles)
│   ├── msw-server.ts          ← one server, no handlers
│   ├── customRender.tsx       ← render + root providers
│   ├── TestRootProviders.tsx  ← QueryClient + toast host, nothing feature-specific
│   ├── testkit.ts             ← the KitFixtures type
│   ├── next-navigation.mock.ts ← the Ambient transport
│   ├── server-only-mock.ts    ← no-op for `import 'server-only'`
│   └── drivers/
│       └── toaster.ts         ← shared design-system driver, borrowed by kits
│
└── src/features/<feature>/testkit/   ← per-feature kits (see 03-architecture.md §3)
```
