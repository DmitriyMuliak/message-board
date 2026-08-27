import { http, HttpResponse, delay, type RequestHandler } from 'msw';

import type { Spotlight } from '../model/types';

/**
 * The host's OWN network world. It knows nothing about the author card's —
 * that world belongs to the author kit, and this kit reaches it only through
 * `author.setup()`, never through `author.net`.
 */
type SpotlightNetWorld = {
  message: Spotlight;
  status: 'ok' | 'notFound' | 'serverError';
  latencyMs: number;
};

const initialWorld = (): SpotlightNetWorld => ({
  message: { id: 'm_1', body: 'Hello world', authorId: 'u_1', pinned: false },
  status: 'ok',
  latencyMs: 0,
});

export function createSpotlightNet() {
  let world = initialWorld();

  const handlers: RequestHandler[] = [
    http.get('/api/messages/:id/spotlight', async ({ params }) => {
      await delay(world.latencyMs);

      if (world.status === 'notFound') {
        return HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'No such message.' } },
          { status: 404 },
        );
      }
      if (world.status === 'serverError') {
        return HttpResponse.error();
      }

      return HttpResponse.json({ ...world.message, id: String(params.id) });
    }),
  ];

  return {
    handlers,
    world: {
      set: (patch: Partial<Spotlight>) => {
        world.message = { ...world.message, ...patch };
      },
      fails: (status: SpotlightNetWorld['status']) => {
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
