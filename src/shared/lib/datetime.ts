/**
 * Timestamp formatting (§12 of ARCHITECTURE.md): compact relative strings
 * for recent messages (`2m`, `18m`, `1h`, `3d`), falling back to a short
 * absolute date once a message is more than 7 days old (`Jun 12`), plus a
 * full absolute datetime for a `title` attribute. Both directions are
 * computed from a UTC ISO-8601 `createdAt` string and `Date.now()` — the
 * relative *delta* is timezone-independent (both ends are absolute
 * instants), but the absolute renderings below use the runtime's local
 * timezone by not passing an explicit `timeZone` to `Intl.DateTimeFormat`,
 * which is exactly "the viewer's local TZ" on the client and "the server's
 * TZ" during SSR — the source of the intentional, leaf-contained
 * SSR/client-first-paint mismatch documented on `RelativeTime` (§12).
 *
 * `LOCALE` is a fixed constant rather than `navigator.language` (§16: i18n
 * is *ready*, not implemented — a single constant is what a later
 * `next-intl` swap would replace). Reading the visitor's real locale
 * client-side would also introduce a *second*, undocumented SSR/client
 * mismatch on top of the one already accepted for relative time; a fixed
 * constant avoids that entirely.
 */
export const LOCALE = 'en-US';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** "Beyond 7 days" (§12) — i.e. this many ms or fewer still renders as a
 * compact relative day count; anything past it renders as an absolute date. */
const RELATIVE_CUTOFF_MS = 7 * DAY_MS;

// Constructed once at module scope (Intl formatter construction isn't free)
// rather than per call — safe because `LOCALE` is a fixed constant, not
// per-render state.
const relativeTimeFormat = new Intl.RelativeTimeFormat(LOCALE, {
  numeric: 'always',
  style: 'narrow',
});
const absoluteCompactFormat = new Intl.DateTimeFormat(LOCALE, { month: 'short', day: 'numeric' });
const absoluteFullFormat = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: 'long',
  timeStyle: 'short',
});

/**
 * Renders `value` + `unit` as this app's compact suffix (`2m`, `18m`, `1h`,
 * `3d` — no "ago", no space): the numeral comes from
 * `Intl.RelativeTimeFormat.formatToParts`'s `"integer"` part (so a future
 * non-Latin-numeral locale would still shape correctly), and the unit
 * letter is our own fixed mapping, not Intl's own localized phrase.
 */
function compactUnit(value: number, unit: 'minute' | 'hour' | 'day', suffix: string): string {
  const parts = relativeTimeFormat.formatToParts(-value, unit);
  const integerPart = parts.find((part) => part.type === 'integer');
  return `${integerPart?.value ?? value}${suffix}`;
}

/**
 * Compact relative time for a UTC ISO `createdAt`: `now` (<60s),
 * `Nm` (<60m), `Nh` (<24h), `Nd` (<=7d), then an absolute `"Jun 12"`-style
 * date beyond 7 days. `now` defaults to `Date.now()` but is an explicit
 * parameter so callers (and tests) can pin it instead of mocking the global
 * clock — the spec shows no sub-minute example, so "now" (no example value)
 * is this app's own minimal, documented choice for that bucket.
 *
 * Negative deltas (a `createdAt` slightly in the future, e.g. clock skew
 * between the mock server and a viewer's machine) clamp to 0 rather than
 * rendering a negative count.
 */
export function formatRelativeTime(createdAt: string, now: number = Date.now()): string {
  const createdAtMs = new Date(createdAt).getTime();
  const diffMs = Math.max(0, now - createdAtMs);

  if (diffMs < MINUTE_MS) {
    return 'now';
  }
  if (diffMs < HOUR_MS) {
    return compactUnit(Math.floor(diffMs / MINUTE_MS), 'minute', 'm');
  }
  if (diffMs < DAY_MS) {
    return compactUnit(Math.floor(diffMs / HOUR_MS), 'hour', 'h');
  }
  if (diffMs <= RELATIVE_CUTOFF_MS) {
    return compactUnit(Math.floor(diffMs / DAY_MS), 'day', 'd');
  }
  return absoluteCompactFormat.format(createdAtMs);
}

/** Full absolute datetime (e.g. `"July 3, 2026 at 2:45 PM"`) for a `title`
 * attribute — the always-available, unambiguous fallback next to whatever
 * compact/relative string is currently rendered (§12). */
export function formatAbsoluteDateTime(createdAt: string): string {
  return absoluteFullFormat.format(new Date(createdAt));
}
