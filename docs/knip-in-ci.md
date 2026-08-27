# Why knip runs in CI

[knip](https://knip.dev) is a dead-code finder — its own description is _"Find and fix unused
dependencies, exports and files in your TypeScript and JavaScript projects"_. The name is Dutch for
"cut". It runs as two separate CI steps in [`verify.yml`](../.github/workflows/verify.yml), and it is
there for a specific structural reason, not for tidiness.

## The hole the public-API rule opened

Rule 3 in [`lint-rules.md`](./architecture/lint-rules.md) bans deep imports, which
forces every slice to have an `index.ts`. That barrel then **hides dead code from ESLint**: within
`index.ts` a re-export always looks used, and ESLint reads one file at a time. Whether anything on the
other side imports the symbol is a module-graph question, and structurally not one ESLint can answer.

So adding the public-API rule would, on its own, have created a hiding place. knip closes exactly that
hole — which is why the CI step is labelled the other half of the architecture gate.

## What the default run checks

`pnpm knip`:

- **unused exports** — the barrel promises a symbol nobody imports
- **unused files** — a module nothing references
- **unused dependencies** in `package.json`, and the inverse (`unlisted`: imported, never declared)
- duplicate exports, dead enum and type members

It exits non-zero on a find, so it needs no wrapper to work as a gate.

## What the config has to tell it

knip's plugins infer most entry points on their own: the Next plugin finds `src/app/**` (including
`src/proxy.ts` — it knows about Next 16's rename of `middleware.ts`), the Vitest plugin finds the
suites, and `package.json` scripts cover the rest.

[`knip.jsonc`](../knip.jsonc) declares only what no module graph can see:

- the husky hooks, which shell files invoke with `node ./…`
- the commit-message linter's own suites, which are `node:test` rather than Vitest
- `tests/unit/test-utils/input-driver.reference.ts` — a worked reference for
  [`testkit-component.md`](./testkit-component.md) that nothing imports on purpose

## The escape hatch: `@public`

An export that is unimported **on purpose** says so with a JSDoc `@public` tag. There are six today —
`MessageCardProps`, `TagSelectProps`, `AvatarVariant`, `ButtonVariant`, `ErrorBoundaryFallbackProps`
and one in `server/db.ts`. The policy for when a tag is justified is in
[`inner/ARCHITECTURE.md` → Public API decisions](./inner/ARCHITECTURE.md#public-api-decisions): an
export is a promise, so the bar is "a consumer actually imports it, or it is a marked extension
point".

That tag is also the proof the gate works. All six really are unimported, and `pnpm knip` passes
**only because of the tags** — remove one and CI goes red.

## Two runs, two questions

Both steps are knip, and they ask different things:

| Step                 | Command                      | Question                                                                          |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| **Dead code**        | `knip`                       | Is anything here dead? Whole project: `src`, `tests`, husky hooks, root configs   |
| **Production graph** | `knip --production --strict` | Did test-side code leak into what we ship? Only the graph from production entries |

The second is the structural half of rule 6 ("production code imports no tests"). The ESLint half
works from a list of package names, and any such list ages; this one needs no list — it knows what a
devDependency is from `package.json`. `--strict` is the operative flag: plain `--production` reports
nothing here, measured.

What separates the two is the `!` suffix in `knip.jsonc`'s `project`: `src/**/*.{ts,tsx}!` is
production, and the four test-side suffixes (`.test.`, `.testkit.`, `.harness.`, `.fixture.`) are
excluded from production while staying in the default run, so their own dead exports are still
reported.

## The one thing it cannot see

`knip --production --strict` does **not** catch a production file importing a harness by path
(`@tests/…`). In production mode `tests/**` is outside the project, so knip has no opinion on it. That
case belongs to the `no-restricted-imports` patterns in
[`eslint.config.mjs`](../eslint.config.mjs). Package names catch the harm from any file, file names
catch the harm from any package, and each covers what the other structurally cannot — which is why
both halves are in CI.

## Not in CI: `--fix`

`knip --fix` removes unused exports and dependencies automatically. Run it locally, by hand, and read
the diff. Autofix has no place in a gate.
