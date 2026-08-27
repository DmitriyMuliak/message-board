import type { TestContext } from 'vitest';

/**
 * A Vitest fixtures object, decoupled from any particular `test` instance.
 *
 * A kit exports one of these instead of a ready-made `test`, so a test file can
 * compose however many kits it needs:
 *
 * ```ts
 * const test = base
 *   .extend(authorCardFixtures)
 *   .extend(messageSpotlightFixtures);
 * ```
 *
 * Exporting a `test` from a kit would bind the runner's entry point to one
 * component, and two unrelated kits could then never meet in the same file.
 *
 * `Own`  — the fixtures this kit contributes.
 * `Deps` — fixtures it expects another kit to have already provided.
 *
 * The context mirrors Vitest's own `FixtureFn`: the fixture being defined is
 * omitted (it cannot depend on itself) and `TestContext` is always present.
 * Annotating the object with this type is what lets the call site be a bare
 * `.extend(obj)` — passing an explicit `.extend<T>(obj)` generic instead binds
 * `T` to Vitest 4's scoped-fixture overload, where the type parameter is a
 * fixture *name*, and the context silently loses every fixture.
 */
export type KitFixtures<Own, Deps = object> = {
  [K in keyof Own]:
    | Own[K]
    | ((
        context: Omit<Own, K> & Deps & TestContext,
        provide: (value: Own[K]) => Promise<void>,
      ) => Promise<void>);
};
