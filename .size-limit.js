/**
 * Bundle-size budgets, enforced as a CI gate (`pnpm size`, run after `next build`
 * in [verify.yml](.github/workflows/verify.yml)). `size-limit` exits non-zero when
 * a budget is exceeded, so the build fails on the regression rather than on
 * someone noticing it in a review three weeks later.
 *
 * Why whole-output globs and not per-route First Load JS: the per-route number no
 * longer exists. Next 16 removed build-time route stats — the table `next build`
 * prints has no `Size`/`First Load JS` column, and Turbopack (the default bundler
 * for `next build` since 16, not just for `next dev`) emits no
 * `app-build-manifest.json`, so there is no route → chunk mapping left to script
 * against either. Only flat, content-hashed chunks (`chunks/2f0cmt6gikabx.js`).
 * The removal was deliberate: the old numbers undercounted webpack and
 * overcounted Turbopack, reporting regressions that did not exist —
 * https://github.com/vercel/next.js/issues/85712.
 *
 * So the number that *is* still measurable is everything we ship to a browser,
 * and that is also the number a careless dependency moves, which is what this
 * gate exists to catch. What it cannot see is one route doubling while the total
 * holds. For that, `pnpm analyze` (`next experimental-analyze`, 16.1+) opens
 * Turbopack's module graph with a per-route filter and the import chain that
 * explains why a module is in there. It is interactive-only — no JSON, no exit
 * code — so it diagnoses what this gate detects; it cannot replace it.
 *
 * Budgets are seeded from the current build with ~10% headroom on JS, and a
 * little more on CSS: Tailwind emits one rule per utility, so a handful of new
 * classes moves a 6 kB stylesheet by more than 10% while meaning nothing.
 *
 * Raising a budget is a legitimate move — deliberately, in a diff, with a reason.
 * That is the point of a number in a file rather than a number in someone's head.
 *
 * @type {import('size-limit').SizeLimitConfig}
 */
module.exports = [
  {
    name: 'client JS — all routes, gzipped',
    path: '.next/static/chunks/**/*.js',
    limit: '415 kB', // measured 377.27 kB
    gzip: true,
  },
  {
    name: 'client CSS — gzipped',
    path: '.next/static/chunks/**/*.css',
    limit: '7.5 kB', // measured 6.44 kB
    gzip: true,
  },
];
