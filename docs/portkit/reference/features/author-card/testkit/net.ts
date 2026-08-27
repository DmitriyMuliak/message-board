import { http, HttpResponse, delay, type RequestHandler } from 'msw';

import type { AuthorProfile } from '../model/types';

/**
 * The NETWORK transport: a mutable world plus the handlers that serve it.
 *
 * Two structural rules live in this file.
 *
 * 1. Handlers are registered ONCE and read `world` at REQUEST time. That is why
 *    a scenario can be set after the handlers are installed and still take
 *    effect, and why `scenario` never needs to call `server.use` per test.
 *
 * 2. Nothing here speaks the domain. `world.fails('notFound')` is infrastructure
 *    vocabulary; `scenario.authorIsMissing()` in the kit is the domain word for
 *    it. Keeping them apart is what lets one domain fact move two transports.
 */
type AuthorNetWorld = {
  profile: AuthorProfile;
  status: 'ok' | 'notFound' | 'serverError';
  latencyMs: number;
};

const initialWorld = (): AuthorNetWorld => ({
  profile: {
    id: 'u_1',
    name: 'Ada Lovelace',
    handle: 'ada',
    followers: 128,
    isFollowedByViewer: false,
  },
  status: 'ok',
  latencyMs: 0,
});

export function createAuthorNet() {
  let world = initialWorld();

  const handlers: RequestHandler[] = [
    http.get('/api/authors/:id', async ({ params }) => {
      await delay(world.latencyMs);

      if (world.status === 'notFound') {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'No such author.' } },
          { status: 404 },
        );
      }
      if (world.status === 'serverError') {
        return HttpResponse.error();
      }

      return HttpResponse.json({ ...world.profile, id: String(params.id) });
    }),
  ];

  return {
    handlers,
    world: {
      set: (patch: Partial<AuthorProfile>) => {
        world.profile = { ...world.profile, ...patch };
      },
      fails: (status: AuthorNetWorld['status']) => {
        world.status = status;
      },
      slow: (ms = 3000) => {
        world.latencyMs = ms;
      },
    },
    reset: () => {
      world = initialWorld();
    },
  };
}
