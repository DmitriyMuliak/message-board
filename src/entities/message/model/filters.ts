import { z } from 'zod';

import { TAGS, type Tag } from '@/shared/config/constants';

/**
 * The **message list contract** — which messages a caller is asking for.
 *
 * This lives in `entities/message`, not in `features/feed-filters`, on purpose.
 * It is the shape of a query against the message domain: the API route validates
 * it, the server service applies it, `messageKeys.list()` is built from it, and
 * the optimistic create checks a new message against it. Everything that touches
 * the feed needs this type — so parking it in a UI feature forced `entities` and
 * `server` to import *upwards*, which is the one rule FSD does not bend on.
 *
 * `features/feed-filters` keeps what is genuinely its own: reading these filters
 * out of the URL, writing them back, and the controls that do it.
 */
export const feedFiltersSchema = z.object({
  tags: z.array(z.enum(TAGS)),
  user: z.string().min(1).nullable(),
  from: z.iso.date().nullable(),
  to: z.iso.date().nullable(),
});
export type FeedFilters = z.infer<typeof feedFiltersSchema>;

/** "No filters at all" — the identity value of the contract. */
export const EMPTY_FILTERS: FeedFilters = { tags: [], user: null, from: null, to: null };

/**
 * Canonical query-string form of a filter set.
 *
 * Canonical matters twice over: this string is part of the TanStack Query key
 * (so two equivalent filter sets must produce byte-identical keys, or they'd
 * cache separately), and it's the query string sent to `GET /api/messages`.
 * Tags are emitted in `TAGS` order rather than selection order for exactly
 * that reason.
 */
export function serializeFilters(filters: FeedFilters): string {
  const parts: string[] = [];

  const orderedTags = TAGS.filter((tag) => filters.tags.includes(tag));
  if (orderedTags.length > 0) {
    parts.push(`tags=${orderedTags.map(encodeURIComponent).join(',')}`);
  }
  if (filters.user) {
    parts.push(`user=${encodeURIComponent(filters.user)}`);
  }
  if (filters.from) {
    parts.push(`from=${encodeURIComponent(filters.from)}`);
  }
  if (filters.to) {
    parts.push(`to=${encodeURIComponent(filters.to)}`);
  }

  return parts.join('&');
}

/**
 * The minimum a message must expose to be matched against filters — deliberately
 * narrower than `Message` so the server can test a raw `DbMessage` (which has
 * `authorId`, not a resolved `author`) without building a full DTO first.
 */
interface FilterableMessage {
  tag: Tag;
  createdAt: string;
  author: { id: string };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The predicate behind the list. One definition, two callers: the server uses it
 * to page the feed, and the optimistic create uses it to decide whether a
 * just-posted message belongs in the list the user is currently looking at.
 * If these ever drifted apart, optimistic UI would start lying.
 */
export function matchesFilters(message: FilterableMessage, filters: FeedFilters): boolean {
  if (filters.tags.length > 0 && !filters.tags.includes(message.tag)) {
    return false;
  }
  if (filters.user !== null && message.author.id !== filters.user) {
    return false;
  }

  if (filters.from !== null || filters.to !== null) {
    const createdAtMs = new Date(message.createdAt).getTime();
    if (filters.from !== null) {
      const fromMs = Date.parse(`${filters.from}T00:00:00.000Z`);
      if (createdAtMs < fromMs) {
        return false;
      }
    }
    if (filters.to !== null) {
      const toExclusiveMs = Date.parse(`${filters.to}T00:00:00.000Z`) + DAY_MS;
      if (createdAtMs >= toExclusiveMs) {
        return false;
      }
    }
  }

  return true;
}
