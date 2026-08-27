# PortKit architecture

The shape of a test kit: what the pieces are, what each is forbidden to know, and the rules that keep
kits composable as widgets nest.

Prerequisites: [`02-fixtures.md`](./02-fixtures.md) for the fixture mechanism,
[`04-setup.md`](./04-setup.md) for the infrastructure this assumes exists.

Every code block below is excerpted from a real file under [`reference/`](./reference/).

---

## 1. The model

A consumer test knows three nouns and one verb:

```tsx
test('a rejected follow keeps the button actionable', async ({ authorCard }) => {
  authorCard.scenario.followIsRejected(); // the world
  authorCard.render(); // the verb
  await authorCard.driver.follow(); // the interaction
  await authorCard.assert.followRejected(); // the contract
});
```

No `vi.mock`, no `server.use`, no `beforeEach`, no module paths. The kit arrives as a fixture,
already installed and already scheduled for teardown.

Inside a kit:

```text
AuthorCardKit
├── driver      → operates the UI            (userEvent, queries)
├── scenario    → defines the world          (domain vocabulary)
├── assert      → states the contract        (a11y-level)
└── transports  → world → infrastructure     (internal, never exported)
    ├── port      a fake object behind a provider
    ├── net       MSW handlers
    └── env       browser / ambient
```

> **Driver operates the UI. Scenario defines the world. Transports translate the world into
> infrastructure. Fixtures own the lifecycle.**

`scenario` never touches MSW or `vi.fn` directly. It says `followIsRejected()`; the transports decide
what that means. One domain scenario routinely moves several transports at once — that is why the
layer exists:

```ts
authorExists: (patch = {}) => {
  net.world.set(patch);                        // Network transport
  actions.succeeds((patch.followers ?? 128) + 1); // Port transport
},
```

### What each layer must not know

| Layer        | Knows about                                  | Must never know about                          |
| ------------ | -------------------------------------------- | ---------------------------------------------- |
| **driver**   | labels, roles, `data-testid`, `userEvent`    | HTTP, the world, the port, kit internals       |
| **net**      | endpoints, response shapes, the world struct | the DOM, queries, `userEvent`                  |
| **port spy** | the interface the widget owns                | the DOM, HTTP                                  |
| **scenario** | domain facts                                 | MSW, `vi.fn`, `localStorage` — call transports |
| **test**     | the kit's public surface                     | handlers, URLs, selectors, module paths        |

### The three transports

| Transport   | Example                            | Mechanism                             | Fragile? |
| ----------- | ---------------------------------- | ------------------------------------- | -------- |
| **Port**    | `follow`, `pin` (server actions)   | interface + provider (DI)             | no       |
| **Network** | `GET /api/authors/:id` on mount    | MSW                                   | no       |
| **Ambient** | `useRouter()`, `useSearchParams()` | `resolve.alias` in `vitest.config.ts` | no       |

The alias is right for the ambient row precisely because a bare vendor specifier has exactly **one
spelling**, so src and tests resolve one module instance and `router.push` is assertable. Never alias
a module inside `src/` — an alias matches the import _string_, so `@/features/x/api/y` in a test and
`../api/y` in the component do not match, and you get two live instances with no error.

### Order of operations

```text
scenario  →  render  →  drive  →  assert
```

`render()` is called by the test, always **after** the scenario — never in a fixture or `beforeEach`.
Rendering first is harmless for a form that fetches nothing and wrong the moment a component loads
data on mount, because the request fires against the default world.

---

## 2. The port

A widget declares what it needs as an interface **it owns**
(`reference/features/author-card/api/author.port.tsx`):

```tsx
'use client';

export interface AuthorPort {
  follow(input: { authorId: string }): Promise<FollowAuthorState>;
}

const AuthorPortContext = createContext<AuthorPort | null>(null);

export function AuthorPortProvider({
  value,
  children,
}: {
  value: AuthorPort;
  children: ReactNode;
}) {
  return <AuthorPortContext.Provider value={value}>{children}</AuthorPortContext.Provider>;
}

export function useAuthorPort(): AuthorPort {
  const port = useContext(AuthorPortContext);
  if (!port) throw new Error('useAuthorPort must be called within an AuthorPortProvider');
  return port;
}
```

The component consumes it, and imports no action:

```tsx
const authorPort = useAuthorPort();
// …
const result = await authorPort.follow({ authorId });
```

**Two placement rules, both load-bearing:**

- The result type (`FollowAuthorState`) lives in `model/types.ts`, **not** in the `'use server'`
  module. The port must be able to describe the operation without depending on the action.
- The port module imports **nothing but `react` and a type**. The moment it imports the action, every
  kit that imports the port drags the whole server graph into jsdom — the exact thing the port exists
  to prevent.

### Where the real binding goes

> **The feature ships its own default wiring. The application mounts nothing.**

A single `<AllPorts>` at the app root is a **service locator, not dependency injection**: one file
that imports every feature, every route paying for all fifty ports when it uses two, and one shared
file every feature must edit.

The provider belongs with the widget — the production mirror of the kit's `wrap()`
(`reference/features/author-card/ui/ConnectedAuthorCard.tsx`):

```tsx
export function ConnectedAuthorCard(props: React.ComponentProps<typeof AuthorCard>) {
  return (
    <ConnectedAuthorPort>
      <AuthorCard {...props} />
    </ConnectedAuthorPort>
  );
}
```

A route renders one thing and mounts nothing. A page using two widgets mounts two, not fifty. Keep
this wrapper in a **separate file** from the port, so the port stays action-free.

### What this bought

|                      | Module mocks                                                          | Ports                            |
| -------------------- | --------------------------------------------------------------------- | -------------------------------- |
| Substitution         | `vi.mock` + module-scope registry + throwing factory                  | a plain object behind a provider |
| Test file header     | `await vi.hoisted(() => import(...))`                                 | ordinary `import`                |
| Import order         | load-bearing, silently breakable                                      | irrelevant                       |
| Two kits in one file | two module boundaries to install                                      | two providers, nested            |
| Nested widget        | child's mock had to register before the parent imported the component | `parent.wrap(child.wrap(ui))`    |

---

## 3. Layout

```text
src/features/author-card/
├── api/
│   ├── author.port.tsx      ← interface + provider + hook (no action import!)
│   ├── author.queries.ts    ← fetch on mount
│   └── follow-author.action.ts
├── model/types.ts           ← domain types INCLUDING action result types
├── ui/
│   ├── AuthorCard.tsx
│   └── ConnectedAuthorCard.tsx  ← default wiring; the testkit never imports this
└── testkit/
    ├── index.tsx            ← the kit factory: driver + scenario + assert + wrap
    ├── fixtures.ts          ← exports a fixtures OBJECT; the test file composes
    ├── driver.ts
    └── net.ts               ← MSW handlers + world
```

The kit sits next to the feature: the module owns its own test surface, the kit changes in the same
PR as the code it mirrors, and deleting the feature deletes the kit.

The one cost — files under `src/**/testkit/` import `vitest` — is fenced with a lint boundary. See
[`04-setup.md`](./04-setup.md) §5.

---

## 4. The driver

`reference/features/author-card/testkit/driver.ts`. Three sub-layers, and one law.

**`elements`** — every selector, and nothing else. **`actions`** — intent in the user's language.
**`assert`** — the accessibility contract, not the rendered text.

### The law: `elements` must stay the `Object.assign` target

The driver is constructed **before** `render()` runs, so at construction time the DOM is empty. Every
member of `elements` is a lazy getter for exactly that reason.

```ts
Object.assign(elements, actions, { assert });  // ✅ getters stay getters
{ ...elements, ...actions, assert }            // ❌ every getter fires here → throws
```

Spreading evaluates each getter at spread time, querying an empty document. For the same reason
members close over `elements` rather than using `this`, so `const { follow } = driver` keeps working.

### Queries must survive label swaps

The follow button reads `Follow` → `Following…` → `Following`. The driver queries
`getByRole('button', { name: /follow/i })`, which matches all three, so the query keeps working while
the action is in flight.

A driver that queried the exact current copy throws in precisely the state most worth asserting on.
Renaming a control mid-interaction is also an a11y problem in its own right — a screen reader
announces it as a different control.

### A nested driver beats a stub

```ts
const toaster = createToasterDriver();
```

The toast is where a feature's error text actually appears, so the kit borrows the Toaster's own
driver rather than stubbing it. Asserting on real markup rendered by the real component is strictly
better than asserting a mock was called.

The toaster's _own_ a11y contract (`aria-live="polite"`) is asserted once, in the Toaster's test. A
feature test asserting it is testing the wrong module.

---

## 5. The network transport

`reference/features/author-card/testkit/net.ts`. Two structural rules:

**Handlers are registered once; the world is mutable.** Handlers read `world` at _request_ time, not
registration time. That is why a scenario set after installation still takes effect, and why
`scenario` never calls `server.use`. Handler churn per test is what MSW's own guidance tells you to
avoid.

**Nothing here speaks the domain.** `world.fails('notFound')` is infrastructure vocabulary;
`scenario.authorIsMissing()` is the domain word for it. Keeping them apart is what lets one domain
fact move two transports.

If the world has a failure counter (`failNext`), **every handler must consult it** — otherwise
"fail the next request" only ever hits whichever request fires first, and a test about a failing
write silently tests nothing.

---

## 6. The kit

`reference/features/author-card/testkit/index.tsx`. Note four things in it.

**The port spy is typed.** `vi.fn<AuthorPort['follow']>()` breaks compilation when the port's
signature changes; a bare `vi.fn()` does not.

**`wrap` exists for hosts.** A host kit mounts this widget's dependency around its own tree.

**`actions` is an escape hatch**, exposed on purpose but rare. Use it only when the _call contract
itself_ is the behaviour:

```tsx
expect(authorCard.actions.follow).not.toHaveBeenCalled();
```

Anything phrased "and then it shows / navigates / recovers" belongs in `assert`.

**`cleanup()` releases only what the kit owns.** It runs after the global `afterEach`, so the DOM is
gone and MSW handlers are already reset ([`02-fixtures.md`](./02-fixtures.md) §7).

---

## 7. Nested kits

`MessageSpotlight` renders `AuthorCard`, so the spotlight kit **owns** an author kit
(`reference/features/message-spotlight/testkit/index.tsx`).

### The consumer never learns the widget tree

```tsx
const test = base.extend(messageSpotlightFixtures); // ONE import
```

The nested kit surfaces as a namespace on the parent:

```tsx
messageSpotlight.author.scenario.authorExists({ name: 'Ada Lovelace' });
await messageSpotlight.author.driver.follow();
```

Composing at the test file instead — `base.extend(authorFixtures).extend(spotlightFixtures)` — leaks
the internal structure: a consumer would have to know a spotlight contains an author card in order to
write a test about pinning.

### Provider composition

```tsx
const wrap = (ui: ReactNode) => (
  <SpotlightPortProvider value={port}>{author.wrap(ui)}</SpotlightPortProvider>
);
```

Plain React composition. No hoisting, no ordering rule, no module graph involved. This is the payoff
of §2 in one line.

### Lifecycle delegation is manual — and unguarded

The honest trade-off. Vitest's fixture graph knows nothing about `kit.author`; to the runner it is
just data inside the parent's value. The parent calls the child's lifecycle itself:

```ts
setup() {
  author.setup();                            // children first: a later server.use() wins
  if (mswServer) mswServer.use(...net.handlers);
  scenario.messageExists();
},
cleanup() {
  net.reset();
  pin.mockReset();
  view.current = null;
  author.cleanup();                          // reverse order
},
```

Measured order: `parent.setup → author.setup → parent.cleanup → author.cleanup`.

What you are accepting:

- **No laziness.** The child is constructed whether or not the test touches it.
- **No automatic ordering.** Reverse teardown is yours to maintain.
- **Nothing warns you if you forget.** Verified by mutation: deleting `author.setup()` makes tests
  fail with `Unable to find an element with the text: Ada Lovelace`. No error mentions the missing
  call.

Past two children, hold them in an array and iterate — `children.forEach(c => c.setup())` /
`[...children].reverse().forEach(c => c.cleanup())` — so adding one does not mean remembering two
places.

### Rules

1. **A kit exports a fixtures object, never a `test`.** The test file composes.
2. **A parent constructs its children** and exposes them namespaced (`kit.author`), never flattened —
   flattening collides the moment two children have a `succeeds()`.
3. **A parent never reaches into a child's transports.** It calls `author.setup()`, not
   `author.net.handlers`.
4. **`wrap` composes providers**; only the outermost kit calls `customRender`.
5. **A child driver must wait for its own root.** A driver's `root` getter is synchronous on purpose
   (built before `render()`), which is fine standalone — but nested, the child's root does not exist
   until the _parent's_ fetch resolves, so the first synchronous query throws:

   ```ts
   async loaded(name: string) {
     await screen.findByTestId(rootTestId);  // the host may still be loading
     await elements.root.findByText(name);
   }
   ```

   Assertions already wrapped in `waitFor` are safe — `waitFor` retries on the throw.

---

## 8. Hooks and browser APIs

### A hook is not a boundary

A hook is **composition** — your own code, factored. Mocking your own hook mocks the thing under
test. The harness never describes a hook; it describes the world the hook reaches into.

```ts
scenario.authorIsMissing(); // ✅ the world
scenario.useAuthorQueryReturnsError(); // ❌ internal machinery
```

That is also a diagnostic:

> **If you feel the need to describe a hook's behaviour in the harness, the hook owns a real
> dependency — make it a port.**

### Should hooks be tested on their own?

| Kind of hook                          | What to do                                       |
| ------------------------------------- | ------------------------------------------------ |
| Thin adapter over a transport         | **No separate test** — it would test the library |
| Logic independent of the DOM          | **Extract the pure function** and unit-test that |
| Shared public hook with a side effect | A focused test, but through **real** transports  |

Order of preference: **pure function → hook test → mocking the hook (never).**

### Browser APIs are the Ambient transport

**a) jsdom implements it** — `history.pushState`, `localStorage`, `URL`. Do not mock it. Use it, and
let the scenario set the state **semantically**:

```ts
scenario.filtersFromUrl({ tag: 'general' }); // ✅
history.pushState(null, '', '?tag=general'); // ❌ in a test
```

**b) jsdom does not implement it** — `IntersectionObserver`, `ResizeObserver`, `matchMedia`,
clipboard. The fake is installed by the **kit**, in its own `env` installer, with the kit's
lifecycle — not globally in `setup.ts`. A global polyfill makes the behaviour invisible and identical
for every test; a kit installer gives you scenarios:

```ts
scenario.viewportIsNarrow();
```

**c) it is a decision the application makes, not the browser** — clock, randomness, feature flags.
That is a port, exactly like a server action.

### Setup size is a design signal

First, the distinction that matters:

- A page kit that reaches many transports **through child kits** is fine. That is composition; each
  child owns its own.
- A page kit that **itself** constructs eight MSW worlds and eight spies is a different thing: the
  page talks to eight dependencies directly.

The second is a problem, and not because the test file is long:

1. **The setup size is a measurement, not an inconvenience.** The number of things that must be true
   before a component does anything _is_ the definition of its coupling. Making the harness prettier
   removes the reading without changing the number.
2. **Change amplification.** Each of the eight can change independently, and every change lands here.
3. **A combinatorial failure surface nobody defined.** Two transports is four states; eight means you
   are shipping undefined behaviour. The harness makes it visible — you can write
   `kit.author.scenario.authorIsMissing()` next to `kit.scenario.pinServiceIsDown()` and discover
   there is no defined answer.
4. **Nothing is liftable.** No part can be extracted or handed to another team without dragging eight
   dependencies with it.

The fix is not to split the page for its own sake. It is to **push each transport down to the leaf
that uses it**, so the page composes leaf kits and owns zero transports itself.

---

## 9. What the kit assumes of the component

A kit can only be as honest as the component.

### Derived state belongs in the query cache, not in local state

A widget holding `const [justFollowed, setJustFollowed] = useState(false)` breaks when only its id
prop changes: React keeps the component mounted, the flag survives, and **every entity you navigate
to afterwards renders as already-followed, with its button disabled**.

Make the query cache the single source of truth, keyed by id:

```tsx
queryClient.setQueryData<AuthorProfile>(authorKeys.byId(authorId), (previous) =>
  previous ? { ...previous, isFollowedByViewer: true, followers: result.followers } : previous,
);
```

Only the in-flight flag stays local. The kit exposes what a test needs to catch this class of bug — a
re-render with a different id and no remount, exactly what a client-side link does:

```tsx
messageSpotlight.showMessage('m_2');
```

### The a11y contract belongs to whoever owns the markup

Assert a shared component's ARIA in that component's own test, once — never in a feature test that
merely renders it.

---

## 10. Checklist

Before merging a new kit:

- [ ] The widget depends on a **port it owns**, not on a server-action module
- [ ] The port's result types live in `model/`, not in the `'use server'` file
- [ ] The port module imports nothing but `react` and a type
- [ ] The feature ships a `Connected*` wrapper with its default wiring; the app root mounts nothing
- [ ] The kit exports a fixtures **object**, not a `test`
- [ ] `.extend(obj)` is called **without** an explicit generic
- [ ] The fixture's second argument is named `provide`, not `use`
- [ ] `cleanup()` resets spies and its own world; it does **not** touch the DOM or assume MSW
      handlers still exist
- [ ] Child kits are constructed by the parent and namespaced, never flattened
- [ ] `setup()` calls every child's `setup()`, `cleanup()` calls them in reverse — nothing checks this
- [ ] Every child-driver assertion that can run first awaits its own root
- [ ] `scenario` contains no MSW / `vi.fn` / `localStorage` calls — only transport calls
- [ ] `render()` is called by the test, after the scenario
- [ ] Driver queries survive label swaps (`/follow/i`, not `'Follow'`)
- [ ] `elements` is the `Object.assign` target, not a spread
- [ ] No test mocks one of your own hooks
- [ ] DOM-independent logic is a pure function with its own test
- [ ] Browser-API fakes are installed by the kit's `env`, not globally
- [ ] The page kit owns no transports of its own — only child kits
- [ ] Nothing in `src/**` outside `testkit/` imports a kit
