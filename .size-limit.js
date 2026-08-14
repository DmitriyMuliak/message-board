/**
 * Bundle-size budgets, enforced as a CI gate (`pnpm size`, run after `next build`
 * in [verify.yml](.github/workflows/verify.yml)). `size-limit` exits non-zero when
 * a budget is exceeded, so the build fails on the regression rather than on
 * someone noticing it in a review three weeks later.
 *
 * Why whole-output globs and not per-route First Load JS: Next 16 builds with
 * Turbopack, which emits flat, content-hashed chunks (`chunks/2f0cmt6gikabx.js`)
 * with no per-route directory to glob. The number that *is* stable across builds
 * is everything we ship to a browser — and that is also the number a careless
 * dependency moves, which is what this gate exists to catch.
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
