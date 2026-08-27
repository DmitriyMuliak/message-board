import { server } from '@/test-utils/msw-server';
import type { KitFixtures } from '@/test-utils/testkit';
import { createAuthorCardKit, type AuthorCardKitOptions } from './index';

export type AuthorCardFixtures = {
  /** Override per-describe with `test.scoped({ authorCardOptions: … })`. */
  authorCardOptions: AuthorCardKitOptions;
  authorCard: ReturnType<typeof createAuthorCardKit>;
};

/**
 * A fixtures OBJECT, never a ready-made `test`. The test file owns composition,
 * so two unrelated kits can meet in one file.
 *
 * The second argument is positional and named `provide` rather than the
 * documented `use`, because `eslint-plugin-react-hooks` reads a bare `use(...)`
 * call as React 19's `use` hook and fails `rules-of-hooks` on every fixture.
 */
export const authorCardFixtures: KitFixtures<AuthorCardFixtures> = {
  authorCardOptions: {},

  authorCard: async ({ authorCardOptions }, provide) => {
    const kit = createAuthorCardKit({ mswServer: server, ...authorCardOptions });
    kit.setup();
    await provide(kit); // ⏸ suspends here; everything below is the teardown
    kit.cleanup();
  },
};
