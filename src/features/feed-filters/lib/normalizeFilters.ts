import { z } from 'zod';

import { feedFiltersSchema, type FeedFilters } from '@/entities/message';
import { TAGS, type Tag } from '@/shared/config/constants';

/**
 * Untrusted filter input: Next's `searchParams` on the server, `URLSearchParams`
 * on the client. Both are "whatever was in the URL", including nothing valid.
 */
export type RawFeedFilters = Record<string, string | string[] | undefined>;

const TAG_SET: ReadonlySet<string> = new Set(TAGS);

function readField(raw: RawFeedFilters | URLSearchParams, key: string): string | undefined {
  if (raw instanceof URLSearchParams) {
    const joined = raw
      .getAll(key)
      .filter((value) => value.length > 0)
      .join(',');
    return joined.length > 0 ? joined : undefined;
  }

  const value = raw[key];
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const joined = value.filter((entry) => entry.length > 0).join(',');
    return joined.length > 0 ? joined : undefined;
  }
  return value;
}

const isoDateSchema = z.iso.date();

function parseDateOnly(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return isoDateSchema.safeParse(trimmed).success ? trimmed : null;
}

/**
 * Parses a URL into the message-list contract. This is the *URL binding* half of
 * filtering, which is why it belongs to `feed-filters` while the contract itself
 * lives in `entities/message`.
 *
 * A hand-edited or stale URL degrades rather than throws: unknown tags are
 * dropped, an unparseable date becomes `null`, and a reversed range is swapped.
 * The feed must render for any URL a user can type.
 */
export function normalizeFilters(raw: RawFeedFilters | URLSearchParams = {}): FeedFilters {
  const rawTags = readField(raw, 'tags');
  const requestedTags = new Set<Tag>();
  if (rawTags) {
    for (const candidate of rawTags.split(',')) {
      const trimmed = candidate.trim();
      if (TAG_SET.has(trimmed)) {
        requestedTags.add(trimmed as Tag);
      }
    }
  }
  const tags = TAGS.filter((tag) => requestedTags.has(tag));

  const rawUser = readField(raw, 'user')?.trim();
  const user = rawUser ? rawUser : null;

  let from = parseDateOnly(readField(raw, 'from'));
  let to = parseDateOnly(readField(raw, 'to'));
  if (from !== null && to !== null && from > to) {
    [from, to] = [to, from];
  }

  return feedFiltersSchema.parse({ tags, user, from, to });
}
