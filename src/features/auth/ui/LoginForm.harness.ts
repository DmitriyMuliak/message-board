import { http, HttpResponse, delay, type RequestHandler } from 'msw';

const BASE = '/api/widget/v2'; // private API, not exported from the widget package

// This is a simple "world" model for the widget's backend, which can be manipulated by the harness scenario API.
type World = {
  user: { id: string; status: 'active' | 'suspended' | 'unverified' };
  payment: 'ok' | 'declined';
  failNext: number;
  latencyMs: number;
  errorMessage?: string;
};

const initialWorld = (): World => ({
  user: { id: 'u_1', status: 'active' },
  payment: 'ok',
  failNext: 0,
  latencyMs: 0,
});

export function createWidgetHarness() {
  let world = initialWorld();

  const maybeFail = () => {
    if (world.failNext > 0) {
      world.failNext -= 1;
      return HttpResponse.error();
    }
    return null;
  };

  const handlers: RequestHandler[] = [
    http.get(`${BASE}/user`, async () => {
      await delay(world.latencyMs);
      return maybeFail() ?? HttpResponse.json(world.user);
    }),
    http.post(`${BASE}/checkout`, async () => {
      await delay(world.latencyMs);
      // Every handler has to consult the failure counter, or `networkFailsOnce()` can only ever
      // hit whichever request happens to fire first — here, the GET above would always eat it.
      const failed = maybeFail();
      if (failed) return failed;

      if (world.user.status === 'suspended') {
        return HttpResponse.json({ code: 'USER_SUSPENDED' }, { status: 403 });
      }
      if (world.payment === 'declined') {
        return HttpResponse.json(
          { code: 'PAYMENT_DECLINED', errorMessage: world.errorMessage },
          { status: 402 },
        );
      }
      return HttpResponse.json({ orderId: 'o_1' }, { status: 201 });
    }),
  ];

  const scenario = {
    userIsSuspended() {
      world.user.status = 'suspended';
    },
    userIsUnverified() {
      world.user.status = 'unverified';
    },
    paymentDeclined(errorMessage?: string) {
      world.payment = 'declined';
      world.errorMessage = errorMessage || 'Your payment was declined';
    },
    networkFailsOnce() {
      world.failNext = 1;
    },
    respondsSlowly(ms = 3000) {
      world.latencyMs = ms;
    },
    reset() {
      world = initialWorld();
    },
  };

  return { handlers, scenario };
}
