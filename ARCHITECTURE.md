# ARCHITECTURE

The map. What the layers are, what holds them in place, and where to read the detail — each section
here is a paragraph and a link, not the full argument.

What this particular app does and why lives in
[`docs/inner/ARCHITECTURE.md`](docs/inner/ARCHITECTURE.md).

---

## Structure

Feature-Sliced Design. Dependencies point one way:
`app → views → widgets → features → entities → shared`.

```
src/
  app/       Next surface + composition root: RSC pages, route handlers,
             proxy.ts, providers, the query-client factory
  views/     page composition (feed)
  widgets/   composition blocks (header, message-card)
  features/  capabilities (auth, feed-filters, message-compose/edit/delete)
  entities/  domain + its "dumb" UI (message, session)
  shared/    primitives with no domain knowledge (ui, lib, api, config)
  server/    "the backend": in-memory db, services, auth, latency simulation
tests/       the test harness no slice owns; future e2e
```

Every slice is `<layer>/<slice>/{ui,model,api,lib}/` plus an `index.ts`, and that `index.ts` is the
**only** way in. Outside the slice you write `@/entities/message`, never
`@/entities/message/ui/MessageCard`; inside it you use relative paths. That is what makes a slice's
internals free to move — the segment layout above is an implementation detail, not an API.

**Unit tests live next to what they test.** A slice's testing surface is named by suffix: `.test.`,
`.testkit.`, `.harness.`, `.fixture.`. Only the harness that belongs to no slice stays in
[`tests/`](tests).

The boundary that earns its keep is **domain vs. reusable**: `shared/ui/Button` knows nothing about
messages; `MessageCard` knows nothing about filters or who is logged in.

**One zod schema** validates the composer form _and_ the route handler. One definition, no drift —
that schema is the artifact you'd hand a backend team.

### Two layer names that are not stock FSD

- **`views/` is FSD's `pages` layer, renamed.** Next owns `pages/`, so the layer has to be called
  something else — this is where page composition lives, one slice per route.
- **`server/` is a 7th layer, outside FSD entirely.** It is the mocked backend, and FSD has nothing to
  say about backends. Only `app/**` (route handlers, RSCs) and `*.action.ts` server actions may import
  `@/server/**`.

Why `views` and not the official `_pages`, why `server` sits outside the layer stack, and what each
choice costs in lint coverage: [`docs/architecture/layer-naming.md`](docs/architecture/layer-naming.md).

---

## What holds it in place

Prose does not hold an architecture. Seven rules are lint errors in
[`eslint.config.mjs`](eslint.config.mjs), run by husky/lint-staged locally and by
[CI](.github/workflows/verify.yml) on every PR — layer direction, sibling slices, slice public APIs,
who may reach `server/`, `shared/` staying a leaf, production never importing a test, and one factory
for query clients. The list, and what each one is for:
[`docs/architecture/lint-rules.md`](docs/architecture/lint-rules.md).

**The eighth rule is a different tool, because ESLint cannot hold it.** Rule 3 enforces that you come
in _through_ `index.ts`, never what is _in_ it — and ESLint reads one file at a time, so to a barrel a
re-export always looks used. Whether anything on the other side imports it is a module-graph
question. [`knip`](https://knip.dev) answers it and runs in CI right after `eslint`. The full account
of what it checks and why it is there is in [`docs/knip-in-ci.md`](docs/infra/knip-in-ci.md).

**`@public` is the whole vocabulary**: an export tagged that way may stay unimported. Anything else a
barrel promises has to have a consumer.

**[Steiger](https://github.com/feature-sliced/steiger) is an advisory audit, not a gate.** Run
`pnpm dlx steiger ./src` before a big refactor to see the debt map — but it recognises only canonical
layer names, so it does not traverse `views/` or `server/` at all. Useful as a second opinion; not
something to block a merge on.

---

## Further reading

Deciding whether a thing is a feature or a widget, and who may import whom, is the one part of FSD a
linter cannot settle for you — [`docs/fsd-in-practice.md`](docs/fsd/in-practice.md).

The sections above each have a chapter in [`docs/architecture/`](docs/architecture/README.md), which
holds the arguments this file only summarises:

| Topic                | Chapter                                                     |
| -------------------- | ----------------------------------------------------------- |
| Layer naming         | [`views/` and `server/`](docs/architecture/layer-naming.md) |
| The enforced rules   | [Lint rules](docs/architecture/lint-rules.md)               |
| Fetching and caching | [The data layer](docs/architecture/data-layer.md)           |
| RSC, routes, bundles | [Rendering](docs/architecture/rendering.md)                 |

Standalone guides — things you would look up on their own rather than to understand this repo:

| Topic               | Guide                                                        |
| ------------------- | ------------------------------------------------------------ |
| Classifying a slice | [FSD in practice](docs/fsd/in-practice.md)                   |
| Dead-code gate      | [Why knip runs in CI](docs/infra/knip-in-ci.md)              |
| Component testing   | [TestKit for a component](docs/testing/testkit-component.md) |
| This app in detail  | [Implementation notes](docs/inner/ARCHITECTURE.md)           |
| Everything else     | [Documentation index](docs/docs-index.md)                    |

---

**Run it:** see [`README.md`](README.md).
