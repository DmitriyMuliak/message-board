import { describe, expect, it } from 'vitest';

import { formatAbsoluteDateTime, formatRelativeTime } from '@/shared/lib/datetime';

// A fixed reference instant rather than the real clock — every boundary
// below is expressed as an exact offset from it, so these tests are
// deterministic regardless of when/where they run.
const NOW = new Date('2026-07-10T12:00:00.000Z').getTime();

function minutesAgo(n: number): string {
  return new Date(NOW - n * 60_000).toISOString();
}
function hoursAgo(n: number): string {
  return new Date(NOW - n * 60 * 60_000).toISOString();
}
function daysAgo(n: number): string {
  return new Date(NOW - n * 24 * 60 * 60_000).toISOString();
}

describe('formatRelativeTime', () => {
  it('renders "now" for anything under a minute old', () => {
    expect(formatRelativeTime(new Date(NOW).toISOString(), NOW)).toBe('now');
    expect(formatRelativeTime(new Date(NOW - 59_999).toISOString(), NOW)).toBe('now');
  });

  it('clamps a createdAt slightly in the future (clock skew) to "now" instead of a negative count', () => {
    expect(formatRelativeTime(new Date(NOW + 5_000).toISOString(), NOW)).toBe('now');
  });

  describe('minutes', () => {
    it('renders the 1-minute boundary', () => {
      expect(formatRelativeTime(minutesAgo(1), NOW)).toBe('1m');
    });

    it('renders the spec example "2m"', () => {
      expect(formatRelativeTime(minutesAgo(2), NOW)).toBe('2m');
    });

    it('renders the spec example "18m"', () => {
      expect(formatRelativeTime(minutesAgo(18), NOW)).toBe('18m');
    });

    it('renders the last whole minute just before the hour boundary', () => {
      expect(formatRelativeTime(new Date(NOW - (60 * 60_000 - 1)).toISOString(), NOW)).toBe('59m');
    });
  });

  describe('hours', () => {
    it('renders the 1-hour boundary, matching the spec example "1h"', () => {
      expect(formatRelativeTime(hoursAgo(1), NOW)).toBe('1h');
    });

    it('renders the last whole hour just before the day boundary', () => {
      expect(formatRelativeTime(new Date(NOW - (24 * 60 * 60_000 - 1)).toISOString(), NOW)).toBe(
        '23h',
      );
    });
  });

  describe('days', () => {
    it('renders the 1-day boundary', () => {
      expect(formatRelativeTime(daysAgo(1), NOW)).toBe('1d');
    });

    it('renders the spec example "3d"', () => {
      expect(formatRelativeTime(daysAgo(3), NOW)).toBe('3d');
    });

    it('renders exactly 7 days as a compact "7d" — not yet the absolute fallback', () => {
      expect(formatRelativeTime(daysAgo(7), NOW)).toBe('7d');
    });
  });

  describe('beyond 7 days: absolute fallback', () => {
    // Expected values are derived from the same Intl.DateTimeFormat call
    // the implementation uses (locale 'en-US', { month: 'short', day:
    // 'numeric' }) rather than a hardcoded literal like "Jul 2" — the
    // absolute branch is timezone-sensitive (no explicit `timeZone` is
    // passed, by design — see datetime.ts's file doc), so hardcoding a
    // literal date string would make this test flaky under a CI runner in
    // a different TZ than the one it was written in.
    function expectedAbsolute(createdAt: string): string {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
        new Date(createdAt),
      );
    }

    it('switches to an absolute short date just past the 7-day cutoff', () => {
      const createdAt = new Date(NOW - (7 * 24 * 60 * 60_000 + 1)).toISOString();
      expect(formatRelativeTime(createdAt, NOW)).toBe(expectedAbsolute(createdAt));
    });

    it('renders a message from weeks ago in the spec\'s "Jun 12"-shaped format', () => {
      const createdAt = '2026-06-12T09:00:00.000Z';
      const result = formatRelativeTime(createdAt, NOW);
      expect(result).toBe(expectedAbsolute(createdAt));
      expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    });
  });
});

describe('formatAbsoluteDateTime', () => {
  it('returns the full locale-formatted absolute datetime, for a title attribute', () => {
    const createdAt = '2026-07-03T14:45:00.000Z';
    const expected = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(createdAt));
    expect(formatAbsoluteDateTime(createdAt)).toBe(expected);
  });
});
