import 'server-only';

/**
 * Latency + failure injection for the mock backend.
 *
 * `simulateLatency()` is called from `messages-service.ts` — the service layer —
 * so a delay applies once per operation no matter how the operation is reached:
 * through `/api/**` from the client, or by a direct service call from the RSC
 * prefetch in `app/(main)/page.tsx`. It used to live in `withApiRoute` instead,
 * which meant the SSR path felt no latency at all; now that the feed streams its
 * shell first, that latency is exactly what the feed skeleton is there to cover.
 */

const DEFAULT_LATENCY_MS = 400;
/** Jitter as a fraction of the base latency (±50%), so a run of requests
 * doesn't feel metronomic — still deterministic-*ish* since it's centered
 * on `MOCK_LATENCY_MS`. */
const JITTER_RATIO = 0.5;
const DEFAULT_FAILURE_RATE = 0;

function readLatencyMs(): number {
  const raw = process.env.MOCK_LATENCY_MS;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_LATENCY_MS;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_LATENCY_MS;
}

function readFailureRate(): number {
  const raw = process.env.MOCK_FAILURE_RATE;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_FAILURE_RATE;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_FAILURE_RATE;
  }
  // Clamp to a valid probability instead of letting a typo'd env value
  // (e.g. `50` meaning "50%") always-fail or never-fail in a confusing way.
  return Math.min(Math.max(parsed, 0), 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Awaits a simulated network delay: `MOCK_LATENCY_MS` (default 400) ±
 * jitter, so pending/skeleton states are actually reviewable instead of
 * resolving instantly. `.env.test` sets `MOCK_LATENCY_MS=0`, which this
 * short-circuits to a no-op — keeping tests fast and deterministic.
 */
export async function simulateLatency(): Promise<void> {
  const base = readLatencyMs();
  if (base <= 0) {
    return;
  }
  const jitter = base * JITTER_RATIO * (Math.random() * 2 - 1);
  const delayMs = Math.max(0, Math.round(base + jitter));
  await sleep(delayMs);
}

/**
 * Reads `body[key]` as a string, or `undefined` if `body` isn't a plain
 * object or the field isn't a string. Never throws — safe to call with a
 * `null`/non-object body (e.g. malformed JSON that `request.json()` already
 * swallowed into `null`).
 */
function readStringField(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Decides whether a mutation should be rejected with a simulated `503` (§6).
 * Deterministic escape hatch for demos/reviews: any `content` containing
 * the literal substring `#fail` always fails, so a rollback can be
 * demonstrated on purpose rather than by chance. Otherwise, an optional
 * `MOCK_FAILURE_RATE` (0–1, default 0 — and 0 in `.env.test`) rolls the
 * dice, so ordinary tests stay deterministic unless they opt in.
 */
export function shouldSimulateFailure(body: unknown, key: string): boolean {
  const content = readStringField(body, key);
  if (content?.includes('#fail')) {
    return true;
  }
  return Math.random() < readFailureRate();
}
