# Why PortKit: providers + fixtures

The short version. Everything else in this folder is detail.

## What we chose

**Ports instead of module mocks.** A widget declares what it needs from the outside world as an
interface it owns, and receives an implementation through a React provider. Production mounts the
real one; a test mounts a spy. No `vi.mock`, no `vi.hoisted`, no module registry.

**Vitest fixtures instead of `beforeEach`.** A kit is delivered to a test as a named fixture. Setup
and teardown live in one function, split by a single `await provide(kit)`.

**MSW for reads, ports for everything else.** If it is an HTTP request, intercept it. A port is for
what is _not_ a request: a server action, the clock, randomness, a feature flag.

## Why ports

Module mocking works until kits compose. Then it breaks on the order of two import lines, silently.

A host kit that imports the component before it imports the child's kit binds the _real_ dependency,
the spy records zero calls, and the UI shows a generic error. Nothing errors. The fix is to reorder
two imports — and any import sorter, or an IDE's "organise imports on save", undoes it again.

A correctness property that depends on import order is not defensible in a live codebase. Vitest
states the constraint itself: `vi` cannot be used from a utility file, because module mocking is
deliberately file-scoped. **It does not compose, by design.**

Ports move substitution from the module graph to the React tree, where composition is just
composition: `parent.wrap(child.wrap(ui))`.

## Why fixtures

`let kit` + `beforeEach` + `afterEach` has four defects that fixtures remove outright: the binding is
untyped-until-assigned, setup runs for every test whether or not it is used, setup and teardown drift
apart because they are two blocks, and inter-kit ordering is yours to maintain.

Fixtures are lazy (a kit a test does not name is never built), fresh per test, torn down even when
the test fails, and dependency-ordered by the runner.

## The cost, stated plainly

**Production code changes.** A widget can no longer import its action and call it — it takes the port
from context, and the feature must ship a `Connected*` wrapper with its default wiring. Forget the
wrapper and the component throws at render.

That is a real constraint on every widget. It is also exactly what makes a widget portable.

## When to choose this

**Choose it when** widgets nest and their kits must compose; when a component's dependency is not an
HTTP request; when a kit is consumed by a test that renders the tree itself (another team's widget);
when the same widget must run in more than one host.

**Skip it when** the dependency is already HTTP — MSW alone is enough, and a port buys nothing; when
the module is a bare vendor specifier used app-wide (`next/navigation`) — a `resolve.alias` is the
right tool, because one spelling means one resolved id; when the component is a leaf with no
dependencies at all — render it and drive it.

**Do not reach for a port to replace one of your own hooks.** A hook is composition — your own code,
factored. Mocking it mocks the thing under test. If you feel the urge, the hook owns a real
dependency: extract _that_ as a port, and leave the hook alone.

---

Next: [`02-fixtures.md`](./02-fixtures.md) if fixtures are new, otherwise
[`03-architecture.md`](./03-architecture.md).
