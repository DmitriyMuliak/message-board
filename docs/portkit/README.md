# PortKit

A component testing approach for React + Vitest: **ports for dependencies, fixtures for lifecycle,
MSW for the network**.

A widget declares what it needs from the outside world as an interface it owns and receives an
implementation through a provider — so a test substitutes a dependency by rendering a different
provider, not by mocking a module. Kits are delivered to tests as Vitest fixtures, which makes setup
and teardown one function instead of two blocks.

A test using a kit reads like this, in full:

```tsx
const test = base.extend(authorCardFixtures);

test('a rejected follow keeps the button actionable', async ({ authorCard }) => {
  authorCard.scenario.followIsRejected(); // the world
  authorCard.render(); // the verb
  await authorCard.driver.follow(); // the interaction
  await authorCard.assert.followRejected(); // the contract
});
```

No `vi.mock`, no `vi.hoisted`, no `server.use`, no `beforeEach`, no module paths, no import-order
rule.

---

## Read in this order

| #   | Document                                     | What it answers                                                             |
| --- | -------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | [`01-why.md`](./01-why.md)                   | What we chose, why providers + fixtures, **when to pick this and when not** |
| 2   | [`02-fixtures.md`](./02-fixtures.md)         | How Vitest fixtures work. Skip if you already write them                    |
| 3   | [`03-architecture.md`](./03-architecture.md) | The kit: driver, scenario, transports, nesting, rules, checklist            |
| 4   | [`04-setup.md`](./04-setup.md)               | What must exist in a repo before the first kit                              |
| 5   | [`05-migration.md`](./05-migration.md)       | Converting one widget, step by step                                         |

**Adopting this in a new repo:** 01 → 04 → 03 → 05, with 02 whenever fixtures stop making sense.

**Writing a kit in a repo that already uses it:** 03 §4–§7 and the checklist in §10.

---

## The reference tree

[`reference/`](./reference/) is working code, not pseudocode — the shape of a real suite of passing
tests. Inside the tree `@/` means `reference/`, so every import resolves to a file you can open —
except `@/shared/ui/…` and `@/server/…`, which are deliberately your own code (see
[`04-setup.md`](./04-setup.md)).

```text
reference/                        ← the rule inside this tree is: @/ = reference/
├── vitest.config.ts              ← aliases (the Ambient transport), isolate, setupFiles
│
├── test-utils/                   ← what a repo needs once
│   ├── setup.ts                  ← global lifecycle; note the ordering trap
│   ├── msw-server.ts             ← one server, started with NO handlers
│   ├── customRender.tsx          ← render + root providers
│   ├── TestRootProviders.tsx     ← QueryClient + toast host, nothing feature-specific
│   ├── testkit.ts                ← the KitFixtures type. Copy verbatim
│   ├── next-navigation.mock.ts   ← the Ambient transport
│   ├── server-only-mock.ts
│   └── drivers/toaster.ts        ← a shared design-system driver, borrowed by kits
│
├── features/
│   ├── author-card/              ← a LEAF widget, end to end
│   │   ├── api/author.port.tsx           ← THE port: interface + provider + hook
│   │   ├── api/author.queries.ts         ← the read (HTTP → MSW covers it)
│   │   ├── api/follow-author.action.ts   ← the write (the port's real implementation)
│   │   ├── model/types.ts                ← domain types INCLUDING the result type
│   │   ├── ui/AuthorCard.tsx             ← consumes the port; imports no action
│   │   ├── ui/ConnectedAuthorCard.tsx    ← the feature's own default wiring
│   │   └── testkit/
│   │       ├── net.ts                    ← world + MSW handlers
│   │       ├── driver.ts                 ← elements / actions / assert
│   │       ├── index.tsx                 ← the kit factory
│   │       └── fixtures.ts               ← the fixtures object
│   │
│   └── message-spotlight/        ← a HOST widget that renders the leaf
│       ├── api/  model/  ui/             ← same shape, plus ConnectedMessageSpotlight
│       └── testkit/                      ← a kit that OWNS a child kit
│
└── tests/                        ← the consumer tests, leaf and nested
```

Start with `features/author-card/testkit/index.tsx`: it is the centre of the approach, and every other file is
either something it uses or something it is used by.

---

## The one-paragraph rationale

Module mocking is file-scoped by design — `vi.mock` is hoisted per file, and Vitest states outright
that `vi` cannot be driven from a utility module. That is fine for a single component and fails the
moment kits compose: a host kit that imports the component before the child's kit binds the real
dependency, the spy records zero calls, nothing errors, and the fix is the order of two import lines
that any import sorter will undo. Ports move substitution out of the module graph and into the React
tree, where composition is just composition. Fixtures then remove the `let kit` + `beforeEach` +
`afterEach` triple, and with it the laziness, ordering and drift problems that come with it.

The cost is real and worth stating in the same breath: **production code changes**. A widget takes
its dependency from context and the feature ships a `Connected*` wrapper. That is a constraint on
every widget — and it is the same constraint that makes a widget portable.
