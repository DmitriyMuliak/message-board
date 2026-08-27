# TestKit for a component — driver + harness (MSW only)

How one component ships its own testing surface, and how that surface survives being wrapped by a
widget you do not own.

**Scope.** This document covers exactly one transport: **the network, via MSW**. Server actions,
`vi.mock`, ports/providers and the fixture lifecycle are deliberately out of scope here. Everything
below is the code that exists today in `src/features/auth/ui/` — a slice's testing surface lives
inside the slice, next to what it tests, and only the harness that belongs to no slice stays in
[`tests/`](../../tests).

The worked example is four real files:

| File                                                  | Role                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| `src/features/auth/ui/LoginForm.tsx`                  | the component under test                                          |
| `src/features/auth/ui/LoginWidgetExample.fixture.tsx` | a widget from another team that embeds `LoginForm`                |
| `src/features/auth/ui/LoginForm.testkit.tsx`          | the kit: props + driver + lifecycle, and a renderer built on it   |
| `src/features/auth/ui/LoginForm.harness.ts`           | the harness: a world, its MSW handlers, and a scenario vocabulary |

The suffix is load-bearing, not decorative: `.test.` / `.testkit.` / `.harness.` / `.fixture.` are
what [`eslint.config.mjs`](../../eslint.config.mjs) rule 4 and [`knip.jsonc`](../../knip.jsonc) use to tell
test-side code from production code, now that the directory no longer does. A file that forgets the
suffix is treated as production and fails the lint rule that bans importing `msw` — loudly, which is
the point.

---

## 1. Three nouns, one verb

```text
LoginFormTestKit
├── props        → what the component is mounted with
├── driver       → operates the UI            (queries, userEvent, a11y assertions)
├── harness      → owns the world             (scenario vocabulary + MSW handlers)
└── testCycle    → installs and tears down    (onSetup / onCleanup)

rendererLoginForm = LoginFormTestKit + render()   ← the verb, for the owner's tests only
```

> **The driver operates the UI. The harness owns the world. The kit assembles them. Whoever renders
> is a separate decision.**

That last clause is the whole point of the split. A component's own test wants the kit to render for
it. A consumer test embedding the component inside someone else's widget must render the _widget_ —
but still needs the same driver and the same world. One kit serves both because `render` is not
baked into it.

| Layer       | Knows about                                   | Must never know about                     |
| ----------- | --------------------------------------------- | ----------------------------------------- |
| **driver**  | labels, roles, `data-testid`, `userEvent`     | HTTP, MSW, the world, component internals |
| **harness** | domain vocabulary, endpoints, response shapes | the DOM, queries, `userEvent`             |
| **kit**     | both of the above, plus default props         | which component tree finally gets mounted |
| **test**    | the kit's public surface                      | handlers, URLs, selectors                 |

---

## 2. The kit — an assembly point, not a renderer

```tsx
// src/features/auth/ui/LoginForm.testkit.tsx
export const LoginFormTestKit = ({
  overrideProps,
  mswServer,
}: LoginFormTestKitParams = defaults) => {
  const defaultProps = {};
  const harness = createWidgetHarness();
  const driver = createLoginFormDriver();

  const testCycleMethods = {
    onSetup: () => {
      mswServer?.use(...harness.handlers);
    },
    onCleanup: () => {},
  };

  return { props: { ...defaultProps, ...overrideProps }, driver, testCycleMethods, harness };
};
```

Four things are returned, and each exists for a reason:

- **`props`** — `defaultProps` merged with `overrideProps`. The kit owns the _valid default mount_,
  so a test that cares about one prop overrides one prop instead of restating the whole set. When a
  required prop is added to `LoginForm`, one file changes, not every test.
- **`driver`** — constructed **before** any render. See §3 for the law that makes that safe.
- **`harness`** — constructed per kit instance, so the world is per test, not per file (§4).
- **`testCycleMethods`** — the installation seam. `onSetup` is where the harness's handlers reach
  MSW; `onCleanup` is its counterpart and is intentionally empty today (the global `afterEach`
  already resets handlers — §6). Keeping the empty hook is what lets a kit later acquire a teardown
  without touching a single call site.

`mswServer` is injected, not imported. The kit never reaches for the singleton itself, which is what
makes it usable in a test file that wants to install handlers on its own terms (§5.2).

### The renderer is a thin wrapper on top

```tsx
export const rendererLoginForm = ({ renderOptions, ...restParams } = defaults) => {
  const { props, driver, testCycleMethods, harness } = LoginFormTestKit(restParams);

  return {
    render: () => customRender(<LoginForm {...props} />, renderOptions),
    props,
    driver,
    harness,
    testCycleMethods,
  };
};
```

`customRender` wraps the tree in `TestRootProviders` (QueryClient + Toaster), so `render()` here is
"mount the component the way the app mounts it". The renderer adds a verb and re-exports the rest
untouched — it is a convenience for the component's owner, never a requirement for a consumer.

---

## 3. The driver — the only thing that touches the DOM

```tsx
const FIELD_LABELS = { email: 'Email', password: 'Password' } as const;
export type LoginFormField = keyof typeof FIELD_LABELS;

export const createLoginFormDriver = ({ rootTestId } = { rootTestId: 'login-form' }) => {
  const user = userEvent.setup();
  const getRoot = () => screen.getByTestId(rootTestId);

  const elements = {
    get root() {
      return within(getRoot());
    },
    input(field: LoginFormField) {
      return elements.root.getByLabelText(FIELD_LABELS[field]);
    },
    get emailInput() {
      return elements.input('email');
    },
    get passwordInput() {
      return elements.input('password');
    },
    get submitButton() {
      return elements.root.getByRole('button', { name: /log in/i });
    },
  };

  const actions = {
    async fillEmail(email: string) {
      await user.type(elements.emailInput, email);
    },
    async fillPassword(pass: string) {
      await user.type(elements.passwordInput, pass);
    },
    async submit() {
      await user.click(elements.submitButton);
    },
    async loginAs(email: string, pass: string) {
      await actions.fillEmail(email);
      await actions.fillPassword(pass);
      await actions.submit();
    },
  };

  const assert = {
    async fieldError(field: LoginFormField, message: string | RegExp) {
      const input = elements.input(field);
      await waitFor(() => {
        expect(input).toBeInvalid();
        expect(input).toHaveAccessibleDescription(message);
      });
    },
    noFieldError(field: LoginFormField) {
      expect(elements.input(field)).toBeValid();
    },
  };

  return Object.assign(elements, { actions }, { assert });
};
```

### Three sub-layers, on purpose

- **`elements`** — where every selector lives. `FIELD_LABELS` is the single source of truth for
  labels, and `input(field)` is the only lookup; the named getters are sugar over it. A label change
  in `LoginForm.tsx` is a one-line change here.
- **`actions`** — intent, in the user's language. `loginAs()` composes the smaller actions rather
  than re-querying, so a change to how "fill the email" works propagates for free.
- **`assert`** — the **accessibility contract**, not the rendered text. `fieldError` asserts both
  halves of the contract: the field is programmatically invalid _and_ its accessible description
  carries the message. `getByText(message)` would pass on a `<div>` floating anywhere on screen and
  is not what a screen-reader user gets. This is a project-wide convention, not a habit of this kit —
  see [`inner/ARCHITECTURE.md` → Conventions](../inner/ARCHITECTURE.md#conventions).

### The one law: `elements` must stay the `Object.assign` **target**

The driver is created **before** `render()` runs, so at construction time the DOM is empty. Every
member of `elements` is a lazy getter for exactly that reason.

```tsx
Object.assign(elements, { actions } , { assert });   // ✅ getters stay getters
{ ...elements, actions, assert }                     // ❌ every getter is invoked right here → throws
```

Spreading evaluates each getter at spread time, which calls `getRoot()` against an empty document
and fails with "unable to find an element by: [data-testid=login-form]". For the same reason members
reference `elements` by closure rather than `this`, so `const { submit } = driver` keeps working
after destructuring.

`userEvent.setup()` runs at construction too — which is safe only while the driver is built once per
test. Building the kit in `beforeEach` (both example tests do) satisfies that.

### Driver primitives: composing instead of repeating

`tests/unit/test-utils/input-driver.reference.ts` factors out the part that is identical for every
text field — `createInputDriver({ label, container })` returns `element` / `state` / `actions` /
`assert` for one input, with `state.description` and `assert.isInvalidWith()` both computed through
`dom-accessibility-api` (the same algorithm jest-dom's `toHaveAccessibleDescription` uses, so state
and assertions can never disagree about what "the description" is).

The composition direction is **component driver → field drivers**, never the reverse:

```text
LoginFormDriver
├── email    = createInputDriver({ label: 'Email',    container: root })
├── password = createInputDriver({ label: 'Password', container: root })
└── submit / loginAs / assert.*     ← component-level vocabulary stays here
```

A field driver knows about one input. It never knows it is inside a login form. Passing `container:
getRoot()` is what scopes it, and is also what keeps two forms on one screen from colliding.

---

## 4. The harness — a world, a translation, and a vocabulary

```ts
// src/features/auth/ui/LoginForm.harness.ts
const BASE = '/api/widget/v2'; // private API, not exported from the widget package

type World = {
  user: { id: string; status: 'active' | 'suspended' | 'unverified' };
  payment: 'ok' | 'declined';
  failNext: number;
  latencyMs: number;
  errorMessage?: string;
};

export function createWidgetHarness() {
  let world = initialWorld();

  const maybeFail = () => {
    if (world.failNext > 0) {
      world.failNext -= 1;
      return HttpResponse.error();
    }
    return null;
  };

  const handlers: RequestHandler[] = [
    http.get(`${BASE}/user`, async () => {
      await delay(world.latencyMs);
      return maybeFail() ?? HttpResponse.json(world.user);
    }),
    http.post(`${BASE}/checkout`, async () => {
      /* … */
    }),
  ];

  const scenario = {
    userIsSuspended() {
      world.user.status = 'suspended';
    },
    paymentDeclined(errorMessage?: string) {
      /* … */
    },
    networkFailsOnce() {
      world.failNext = 1;
    },
    respondsSlowly(ms = 3000) {
      world.latencyMs = ms;
    },
    reset() {
      world = initialWorld();
    },
  };

  return { handlers, scenario };
}
```

Three structural decisions:

**1. Handlers are registered once; the world is mutable.** Handlers read `world` at _request_ time,
not at registration time. That is why a scenario can be set after handlers are installed and still
take effect, and why `scenario` never needs `server.use` — it only assigns to a closed-over object.
Handler churn per test is exactly what MSW's own guidance tells you to avoid.

**2. `scenario` speaks domain, handlers speak HTTP.** A test says `paymentDeclined()`; whether that
is a 402 with a `PAYMENT_DECLINED` code, a different endpoint, or two endpoints changing at once is
the harness's problem. This is the whole reason the layer exists: one domain fact routinely moves
more than one endpoint, and the test should not have to know which.

**3. Every handler must consult `maybeFail()`.** With the failure counter checked in only one
handler, `networkFailsOnce()` can only ever hit whichever request happens to fire first — here the
`GET /user` on mount would always eat it, and a test about a failing checkout would silently test
nothing. The rule is a per-handler obligation, and the code comments say so at the call site.

**Scope note, honestly stated:** `LoginForm` as it stands today submits through a server action and
makes no HTTP call, so the `user`/`checkout` world above is the _shape_ of a harness demonstrated on
this pair, not a world `LoginForm` currently reaches.

---

## 5. The two ways to consume one kit

### 5.1 Owner test — the kit renders

`src/features/auth/ui/LoginForm.test.tsx`:

```tsx
beforeEach(() => {
  formRenderer = rendererLoginForm({ mswServer: server }); // kit + renderer
  formRenderer.testCycleMethods.onSetup(); // handlers → MSW
  formRenderer.render(); // mount LoginForm

  formDriver = formRenderer.driver;
  formScenario = formRenderer.harness.scenario;
});

afterEach(() => formRenderer.testCycleMethods.onCleanup());

it('blocks submission and shows inline errors for empty fields', async () => {
  await formDriver.submit();
  await formDriver.assert.fieldError('email', 'Email is required.');
  await formDriver.assert.fieldError('password', 'Password is required.');
});
```

The kit is handed the MSW singleton and installs the world itself. The test names no URL, no handler
and no selector.

### 5.2 Consumer test — the kit does **not** render

`src/features/auth/ui/LoginWidgetExample.test.tsx`. `LoginWidgetExample` is "a widget from an
external source (team / library / micro frontend)": it renders `LoginForm` inside its own markup and
exposes only its own props.

```tsx
beforeEach(() => {
  formTestkit = LoginFormTestKit(); // no renderer, no mswServer
  server.use(...formTestkit.harness.handlers); // the consumer installs the world
  customRender(<LoginWidgetExample onSuccess={onSuccess} />); // the consumer renders
});

it('blocks submission for a malformed email', async () => {
  await formTestkit.driver.loginAs('not-an-email@gmail.com', 'dispatch');
  await formTestkit.driver.assert.noFieldError('password');
  expect(onSuccess).not.toHaveBeenCalled();
});
```

This is the case the split was designed for. The consumer cannot reach inside `LoginWidgetExample`
to mount `LoginForm` directly — but the kit crosses the package boundary as a plain object, so the
inner component's driver and world are still available. The only thing the consumer gives up is
`render()`, which it did not want anyway.

```text
        owner test                        consumer test
        ──────────                        ─────────────
rendererLoginForm(...)                 LoginFormTestKit()
   ├── render() ──► <LoginForm/>          ├── driver   ──► queries the DOM the widget produced
   ├── driver                             └── harness  ──► server.use(...handlers)
   └── harness                                    customRender(<LoginWidgetExample/>)
```

Both paths end in the same driver querying the same accessible tree, and the same world answering
the same requests. Only the mount point differs.

---

## 6. Lifecycle with MSW: who resets what

The global setup (`tests/unit/test-utils/setup.ts`) owns the server, once for the whole run:

```ts
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetNextNavigation();
});
afterAll(() => server.close());
```

| State                 | Lives in         | Reset by                                                   |
| --------------------- | ---------------- | ---------------------------------------------------------- |
| the MSW server itself | `msw-server.ts`  | `beforeAll` / `afterAll`, once per file                    |
| installed handlers    | MSW              | global `afterEach` → `server.resetHandlers()`              |
| the harness `world`   | the kit instance | building a new kit in `beforeEach` (or `scenario.reset()`) |
| the rendered DOM      | RTL              | global `afterEach` → `cleanup()`                           |

Two consequences worth stating outright:

- **Build the kit per test, not per file.** The world is closure state. A kit hoisted to module scope
  leaks `paymentDeclined()` from one test into the next, because `resetHandlers()` removes handlers
  but knows nothing about the object they read from. `scenario.reset()` exists for the deliberate
  case where you want one kit across several tests.
- **`onUnhandledRequest: 'warn'`** means an un-installed endpoint degrades to a warning plus a real
  network attempt rather than a loud failure. If a widget starts fetching and its handlers were never
  installed, the symptom is a slow, confusing test — check that `onSetup()` (or `server.use`) ran.

### Ordering

```text
scenario  →  render  →  drive  →  assert
```

---

## 7. Checklist for a new component kit

1. `createXDriver()` — `elements` (lazy getters, selectors in one map) + `actions` (user intent) +
   `assert` (a11y contract). Return `Object.assign(elements, actions, { assert })`.
2. `createXHarness()` — a `World` type, `initialWorld()`, handlers that read `world` at request time,
   a `scenario` in domain words, and `reset()`. Every handler consults the failure counter.
3. `XTestKit({ overrideProps, mswServer })` — merge props, build driver and harness, expose
   `testCycleMethods`. Never import the MSW singleton; take it.
4. `rendererX(...)` — optional, and only ever a `render()` on top of the kit.
5. Build the kit in `beforeEach`. Set the scenario before rendering.
6. Nothing outside the driver queries the DOM. Nothing outside the harness names a URL.

---
