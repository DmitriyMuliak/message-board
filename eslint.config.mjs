import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import importFsd from 'eslint-plugin-import-fsd';

/**
 * ── Architecture rules, enforced ──────────────────────────────────────────────
 *
 * ARCHITECTURE.md promises one-way dependencies. Prose doesn't hold a boundary
 * for more than a couple of sprints, so the promise is a lint error here:
 *
 *   1. Layer direction  — `import-fsd/no-denied-layers`. A layer may only
 *      import from layers strictly below it, and a slice may not import a
 *      sibling slice on its own layer.
 *   2. Public API       — `no-restricted-imports`. Slices are imported as
 *      `@/<layer>/<slice>`; reaching into `ui/`, `model/`, `api/` from outside
 *      is an error, which is what keeps a slice's internals refactorable.
 *   3. `server/` reach  — `no-restricted-imports`. Our non-FSD backend layer is
 *      importable only from `app/**` and `*.action.ts`.
 *
 * `no-restricted-imports` does not merge across config objects — a later block
 * *replaces* the whole rule — so every block that touches it has to name the
 * complete set it wants. Five hand-written lists is the same failure mode rule 7
 * exists to prevent: adding a group means editing all five, and missing one drops
 * a guard in silence, with no error to notice. So the lists are inverted — a block
 * declares what it is *exempt* from and `restrictExcept` composes the rest. A new
 * entry in `RESTRICTIONS` is then on everywhere by default, and switching it off
 * anywhere is a deliberate, greppable opt-out.
 */

/** Slice layers: a slice is `@/<layer>/<slice>` and nothing deeper. `shared` is
 * absent on purpose — it is segment-based, not slice-based, so `@/shared/ui/Button`
 * *is* its public API. */
const SLICE_LAYERS = ['entities', 'features', 'widgets', 'views'];

/**
 * The restricted-import groups, keyed by the name a config block opts out under.
 * Every group applies to every block that sets `no-restricted-imports`, unless that
 * block names it in `restrictExcept` — so adding a key here turns the group on
 * project-wide, and no existing block needs editing to keep up.
 */
const RESTRICTIONS = {
  PUBLIC_API: {
    group: SLICE_LAYERS.flatMap((layer) => [`@/${layer}/*/*`, `@/${layer}/*/*/**`]),
    message:
      "Import a slice through its public API — '@/<layer>/<slice>', not a file inside it. " +
      'Within a slice, use a relative path.',
  },

  SERVER_LAYER: {
    group: ['@/server', '@/server/*', '@/server/*/**'],
    message:
      "'@/server/**' is the mocked backend, not an FSD layer. Only 'app/**' route " +
      "handlers/RSCs and '*.action.ts' server actions may import it.",
  },

  /**
   * Tests may import production code; production code may not import tests. Now
   * that suites sit next to what they test, a stray auto-import is one keystroke
   * away, and the damage is not bundle size — `tests/unit/test-utils/` holds
   * `next-navigation.mock.ts` and `server-only-mock.ts`. A production file that
   * reaches one of those ships a *stub instead of the real implementation*, and no
   * test can catch it, because tests run on the stub by design.
   *
   * Two halves, deliberately unequal:
   *
   * - **Package names** ('vitest', '@testing-library/*', …) are exact strings with
   *   no spelling variants. This half ages — nobody's list knows the next test
   *   package someone installs — but `knip --production --strict` in CI covers
   *   what it misses: that walks the production graph from production entry points
   *   and reports *any* devDependency that turns up in it, by whatever name.
   * - **File names** ('**\/*.test.*', '@tests/*', …) are best-effort:
   *   `no-restricted-imports` matches the specifier *as written*, not the resolved
   *   path, so a relative import has several spellings and this list cannot promise
   *   to cover them all. It is also the *only* guard for the worst case — measured:
   *   knip stays silent on a production file importing
   *   `@tests/unit/test-utils/next-navigation.mock`, because in production mode
   *   `tests/**` is outside the project, so that file is simply not its business.
   *   The package half and the file half each cover what the other cannot.
   */
  TEST_ONLY: {
    group: [
      'vitest',
      'vitest/*',
      '@vitest/*',
      '@testing-library/*',
      'msw',
      'msw/*',
      'jsdom',
      '@tests',
      '@tests/*',
      '**/*.test',
      '**/*.test.*',
      '**/*.spec',
      '**/*.spec.*',
      '**/*.testkit',
      '**/*.testkit.*',
      '**/*.harness',
      '**/*.harness.*',
      '**/*.fixture',
      '**/*.fixture.*',
    ],
    message:
      'Production code may not import tests, test kits, or the test harness. The ' +
      'direction is one-way: a test may import this file, never the reverse — a ' +
      "leaked '@tests/…' mock would ship a stub in place of the real module.",
  },

  /**
   * `makeQueryClient` is the low-level constructor; `app/query-client.ts` is the
   * factory that also installs per-resource query defaults. Three roots create a
   * client — browser provider, RSC prefetch, test renderer — and a root that reaches
   * past the factory does not fail, it silently runs a *different configuration*.
   * That is how the RSC prefetch and the test renderer drifted from the browser in the
   * first place: nothing was checked, so nothing complained.
   *
   * Hence this pattern rather than a comment asking nicely. Note it covers `tests/**`
   * too — the test renderer was the root that actually diverged, and it lives outside
   * `src/`, where none of the other rules reach.
   */
  QUERY_CLIENT: {
    group: ['@/shared/api/query-client', '**/shared/api/query-client'],
    message:
      "Create clients with 'createAppQueryClient' from '@/app/query-client', not with " +
      "'makeQueryClient' directly — the factory is what installs per-resource query " +
      'defaults, and a client without them differs from production in silence.',
  },
};

const RESTRICTION_NAMES = Object.keys(RESTRICTIONS);

/**
 * The `no-restricted-imports` setting for one config block, written as the
 * exemptions it claims: every group in `RESTRICTIONS` except the ones named.
 *
 * An unknown name throws while the config loads. That is the one mistake this
 * inversion could still swallow quietly — a typo'd exemption would leave a
 * restriction on and read as an unrelated lint error at some call site — so it
 * fails here instead, by name, before any file is linted.
 */
function restrictExcept(...exempt) {
  const unknown = exempt.filter((name) => !RESTRICTION_NAMES.includes(name));
  if (unknown.length > 0) {
    throw new Error(
      `restrictExcept: unknown restriction(s) ${unknown.join(', ')}. ` +
        `Known: ${RESTRICTION_NAMES.join(', ')}.`,
    );
  }

  return [
    'error',
    {
      patterns: RESTRICTION_NAMES.filter((name) => !exempt.includes(name)).map(
        (name) => RESTRICTIONS[name],
      ),
    },
  ];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override rules
  {
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true, // Accept: a && b()
          allowTernary: true, // Accept: a ? b() : c()
        },
      ],
    },
  },

  // ── 1. Layer direction ──────────────────────────────────────────────────────
  {
    files: ['src/**/*.{ts,tsx,mts}'],
    plugins: { 'import-fsd': importFsd },
    settings: {
      fsd: {
        rootDir: './src',
        aliases: { '@/*': './src/*' },
      },
    },
    rules: {
      'import-fsd/no-denied-layers': 'error',
      // `server/` is our 7th layer and sits outside FSD entirely, so the plugin
      // rightly calls it unknown — we tell it that's expected. `no-denied-layers`
      // then skips those imports on its own (it can't rank an unknown layer), and
      // who may actually reach `server/` is rule 3 below.
      //
      // Note: the `overrides` setting looks like it should do this job, but it
      // matches the *resolved* path, not the `@/…` specifier, so an
      // `'@/server/*'` key never fires. `ignores` is the working knob.
      'import-fsd/no-unknown-layers': ['error', { ignores: ['server'] }],
      // `views/` is FSD's `pages` layer under a different name — Next already
      // owns `pages/`, so the official FSD guidance for Next is to rename it.
      // The plugin ranks `views` correctly (same rank as `pages`) but also
      // considers the name legacy, which for us it isn't.
      'import-fsd/no-deprecated-layers': ['error', { ignores: ['views'] }],
    },
  },
  {
    // `src/proxy.ts` is Next's middleware entry point (renamed in Next 16). It
    // sits at the root of `src/`, so it is not in any layer at all.
    files: ['src/proxy.ts'],
    rules: {
      'import-fsd/no-denied-layers': 'off',
      'import-fsd/no-unknown-layers': 'off',
      'import-fsd/no-deprecated-layers': 'off',
    },
  },

  // ── 2. Public API · 3. who reaches `server/` · 4. no tests in production ·
  //    7. one query-client factory ───────────────────────────────────────────────
  {
    // Ordinary production code, exempt from nothing.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/app/**', 'src/server/**', 'src/proxy.ts', 'src/**/*.action.ts'],
    rules: {
      'no-restricted-imports': restrictExcept(),
    },
  },
  {
    // The callers allowed to reach `server/` — route handlers/RSCs, `server/` itself,
    // the middleware entry, server actions. Everything else still applies to them.
    files: ['src/app/**/*.{ts,tsx}', 'src/server/**/*.ts', 'src/proxy.ts', 'src/**/*.action.ts'],
    rules: {
      'no-restricted-imports': restrictExcept('SERVER_LAYER'),
    },
  },
  {
    // The factory itself — the one file allowed to reach `makeQueryClient`. Must
    // come after the block above, which would otherwise ban its own single reason
    // for existing.
    files: ['src/app/query-client.ts'],
    rules: {
      'no-restricted-imports': restrictExcept('SERVER_LAYER', 'QUERY_CLIENT'),
    },
  },
  {
    // `tests/**` sits outside `src/`, so none of the blocks above reach it — and the
    // test renderer is exactly the root that drifted from production. Rule 7 is the
    // one rule tests are *not* exempt from: reaching inside a slice makes a test
    // sharper, quietly configuring its own client makes it test the wrong thing.
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictExcept('PUBLIC_API', 'SERVER_LAYER', 'TEST_ONLY'),
    },
  },
  {
    // The other side of rule 4, and it must come *after* every block above to win.
    // Co-located test-side files are exempt from rules 1–6: a test imports `vitest`,
    // mocks a slice's internals (`vi.mock('@/features/auth/api/login.action')`), and
    // reaches the harness in `@tests/…`. A test that cannot do those things just
    // tests less. Rule 7 stays on, for the reason above.
    //
    // Four suffixes, because a slice's testing surface has four kinds of file and
    // the suffix is the *only* thing that marks one as test-side — the directory no
    // longer does, now that suites sit next to what they test:
    //   `.test.`    the suite
    //   `.testkit.` props + driver + lifecycle the suite (or a consumer) drives
    //   `.harness.` the world the component talks to (MSW handlers + scenarios)
    //   `.fixture.` a stand-in component a suite mounts, never shipped
    // A file that forgets the suffix is treated as production code, which is the
    // failure we want: it fails loudly here rather than quietly shipping `msw`.
    files: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.testkit.{ts,tsx}',
      'src/**/*.harness.{ts,tsx}',
      'src/**/*.fixture.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': restrictExcept('PUBLIC_API', 'SERVER_LAYER', 'TEST_ONLY'),
      'import-fsd/no-denied-layers': 'off',
      'import-fsd/no-unknown-layers': 'off',
    },
  },

  prettier,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    'dist/**',
    'node_modules/**',
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Unrelated pre-existing worktree checkouts, not part of this project:
    '.claude/worktrees/**',
  ]),
]);

export default eslintConfig;
