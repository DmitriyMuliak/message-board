# Migrating one widget

From "the component imports its server action and the test mocks the module" to a port with a kit.
One widget at a time, each step independently shippable.

Do **one** widget first, all the way through, before converting a second. The first one buys you the
`KitFixtures` helper, the `customRender` boundary and the argument; the rest are then mechanical.

---

## Where to start

Not the hardest widget, and not the most trivial. Pick one that:

- performs **one write** (a follow, a pin, a delete),
- reads its data over **HTTP**, so MSW covers the read and the port covers only the write,
- is rendered in **one place**, so the `Connected*` wrapper has one call site to fix.

Avoid, for now: forms that rely on progressive enhancement (`<form action={fn}>` posting without JS —
a port changes that story and deserves its own decision), and widgets whose only dependency is
already HTTP (they need no port at all — see [`01-why.md`](./01-why.md), "Skip it when").

---

## Step 1 — Move the result type out of the action module

```ts
// model/types.ts
export type FollowAuthorState =
  { success: true; followers: number } | { success: false; error: string; code?: string };
```

The action imports it from there. Nothing else changes yet, and the suite stays green.

**Why first:** the port must describe the operation without importing the action. If the result type
stays in the `'use server'` file, every kit that imports the port drags the server graph into jsdom —
and you will discover it three steps later as a confusing module-resolution error.

---

## Step 2 — Add the port

A new file, `api/<feature>.port.tsx` — interface, context, provider, hook. Copy the shape from
[`reference/features/author-card/api/author.port.tsx`](./reference/features/author-card/api/author.port.tsx).

Two rules, both checkable:

- it imports **nothing but `react` and a type**;
- the hook **throws** when the provider is missing. A silently `undefined` dependency surfaces much
  later and much worse.

Still green: nothing consumes the port yet.

---

## Step 3 — Switch the component to the port

```diff
-import { followAuthorAction } from '../api/follow-author.action';
+import { useAuthorPort } from '../api/author.port';

 export function AuthorCard({ authorId }: { authorId: string }) {
+  const authorPort = useAuthorPort();
   …
-      const result = await followAuthorAction({ authorId });
+      const result = await authorPort.follow({ authorId });
```

**This is the breaking step.** The component now throws at render unless a provider is above it. Your
existing tests fail here, and so does the app. Steps 4 and 5 fix both — keep them in the same commit.

---

## Step 4 — Ship the default wiring

`ui/Connected<Widget>.tsx` — the production mirror of the kit's `wrap()`. See
[`reference/features/author-card/ui/ConnectedAuthorCard.tsx`](./reference/features/author-card/ui/ConnectedAuthorCard.tsx).

Then change the call sites from `<AuthorCard …/>` to `<ConnectedAuthorCard …/>`.

**Keep this in a separate file from the port.** The port must not import the action; this file is
where that import belongs.

**Do not** put the provider at the app root. One `<AllPorts>` there is a service locator: every route
paying for every feature's ports, and one shared file each feature must edit
([`03-architecture.md`](./03-architecture.md) §2).

The app works again at the end of this step.

---

## Step 5 — Build the kit

Four files under `testkit/`, in this order — each is useful on its own:

1. **`net.ts`** — the world plus MSW handlers for the reads. Handlers read the world at _request_
   time. ([reference](./reference/features/author-card/testkit/net.ts))
2. **`driver.ts`** — `elements` / `actions` / `assert`, returned as
   `Object.assign(elements, actions, { assert })`. ([reference](./reference/features/author-card/testkit/driver.ts))
3. **`index.tsx`** — the kit: the typed port spy, `scenario`, `wrap`, `render`, `setup`, `cleanup`.
   ([reference](./reference/features/author-card/testkit/index.tsx))
4. **`fixtures.ts`** — the fixtures object.
   ([reference](./reference/features/author-card/testkit/fixtures.ts))

---

## Step 6 — Rewrite the test file

Delete, in this order — and notice that each deletion is a constraint leaving the codebase:

```diff
-const kit = await vi.hoisted(async () => await import('./LoginFormHarness'));
-vi.mock(kit.ACTION_MODULE, kit.actionsModuleFactory);
-
-let harness;
-beforeEach(() => {
-  harness = createHarness();
-  harness.onSetup();
-  render(<AuthorCard authorId="u_1" />);
-});
-afterEach(() => harness.onCleanup());
+import { authorCardFixtures } from '@/features/author-card/testkit/fixtures';
+const test = base.extend(authorCardFixtures);
```

Then rewrite each test to `scenario → render → drive → assert`. Full file:
[`reference/tests/AuthorCard.test.tsx`](./reference/tests/AuthorCard.test.tsx).

Note the render moves **out of `beforeEach` and into the test body**. That is not cosmetic: a
component that fetches on mount would otherwise fire its request against the default world before the
test could set one.

---

## Step 7 — Verify the wiring, not the shape

Four checks. The second is the only one that cannot be faked:

1. The test file imports nothing from the feature's `api/`.
2. **The component called your spy** — `expect(kit.actions.follow).toHaveBeenCalled()` after a real
   interaction. `expect(vi.isMockFunction(fn)).toBe(true)` passes even when the component is bound to
   an entirely different module instance; it proves nothing.
3. A scenario set before `render()` changes what the component sees.
4. Deleting the provider from `wrap` throws at render.

---

## Then: nesting

Only after two leaf widgets are converted, and only if one renders the other. The host kit constructs
the child (`createAuthorCardKit({ mswServer })`), composes providers in `wrap`, and delegates
lifecycle **manually** — `author.setup()` first, `author.cleanup()` last.

Nothing warns you if you forget either call. Verified by mutation: removing `author.setup()` fails
tests with `Unable to find an element with the text: …`, and no error names the missing call.

See [`03-architecture.md`](./03-architecture.md) §7 and
[`reference/features/message-spotlight/testkit/index.tsx`](./reference/features/message-spotlight/testkit/index.tsx).

---

## Migration checklist per widget

- [ ] Result types moved to `model/`
- [ ] Port added; imports only `react` + a type; hook throws without a provider
- [ ] Component takes the port from context, imports no action
- [ ] `Connected*` wrapper shipped; every call site updated; app root untouched
- [ ] `net.ts` handlers read the world at request time
- [ ] Driver returns `Object.assign(elements, …)`, queries survive label swaps
- [ ] Kit exposes `scenario` / `driver` / `assert` / `wrap` / `render` / `setup` / `cleanup`
- [ ] `fixtures.ts` exports an object, uses `provide`, no explicit `.extend` generic
- [ ] Test file: no `vi.mock`, no `vi.hoisted`, no `beforeEach`, no module paths
- [ ] `render()` inside the test, after the scenario
- [ ] The spy-was-called check passes

---

## What "done" looks like for the repo

Migrated widgets have no `vi.mock` anywhere near them. Whatever is left un-migrated still works —
module mocking and ports coexist fine, they are different mechanisms.

Two things to watch while a repo is half-converted:

- **Do not leave a widget half-way.** Steps 3–5 must land together, or the app is broken between
  commits.
- **A partly-migrated repo is not a failure state.** Auth forms in particular may be worth leaving on
  actions deliberately — progressive enhancement is a real reason a port does not automatically win.
  Write that decision down rather than leaving it to look like an oversight.
