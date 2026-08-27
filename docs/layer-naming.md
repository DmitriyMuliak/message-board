# `views/` and `server/` — two names that are not stock FSD

Both deviations are deliberate, and both were chosen for what the linter can still check afterwards.
The short version is in [`ARCHITECTURE.md` → Structure](../ARCHITECTURE.md#structure); this is the
argument.

---

## `views/` is FSD's `pages` layer, renamed

That the layer must be renamed **at all** is
[official FSD guidance for Next](https://feature-sliced.design/docs/guides/tech/with-nextjs) —
`pages/` collides with Next's own routing convention. But the name that guidance gives is `_pages`
(with `_app` alongside it), not `views`. So this is a departure from the letter of it, not compliance,
and it needs a reason.

**The reason is lint coverage, and it is checkable.**
[`eslint-plugin-import-fsd`](https://www.npmjs.com/package/eslint-plugin-import-fsd) ships a layer
table (`dist/cjs/utils/layers.js`) in which `view` / `views` / `screen` / `screens` / `layout` /
`layouts` are aliases at **`pages` rank** — flagged legacy, which is what the `no-deprecated-layers`
ignore in [`eslint.config.mjs`](../eslint.config.mjs) is for.

`_pages` is in no table at all. It would be an **unknown** layer, so it would need a
`no-unknown-layers` ignore, and after that `no-denied-layers` silently stops checking every import in
the layer — precisely what already happens to `server/` below.

So the trade is:

| Option   | Layer-direction checking on that layer | Matches official guidance |
| -------- | -------------------------------------- | ------------------------- |
| `_pages` | none — unknown layer, rule goes quiet  | yes                       |
| `views`  | full — ranked at `pages`               | no, deprecated alias      |

We took the checking. A name that matches a document but turns a rule off is worse than a name that
does not and keeps it on.

`app/` keeps its plain name for a different reason: Next's `app/` and FSD's app layer are the same
thing here, composition root included, so they coincide rather than collide.

---

## `server/` is a 7th layer, outside FSD entirely

It is the mocked backend — an in-memory store, services, auth, latency simulation — and FSD has
nothing to say about backends. Rather than pretend it is a layer and rank it, it sits outside the
stack and gets an explicit rule instead of an inferred one:

> Only `app/**` (route handlers, RSCs) and `*.action.ts` server actions may import `@/server/**`.

Two things enforce that, one step apart:

- `import 'server-only'` at the top of those modules turns a leak into a **compile** error.
- Rule 4 in [`docs/lint-rules.md`](./lint-rules.md) turns it into a **lint** error one step earlier,
  in the editor, before the build runs.

The cost is the same one `_pages` would have had: `import-fsd` cannot rank an unknown layer, so
`no-denied-layers` does not check imports _inside_ `server/`. That is why rule 4 is written by hand as
a `no-restricted-imports` pattern rather than left to the plugin — the guard the plugin cannot give,
supplied explicitly.

A note on the plugin's own escape hatch: its `overrides` setting looks like it should map an unknown
path onto a known layer, but it matches the **resolved** path, not the `@/…` specifier, so an
`'@/server/*'` key never fires. `ignores` is the working knob.
