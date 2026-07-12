import { z } from 'zod';
import { TAGS, type Tag } from '@/shared/config/constants';

export const feedFiltersSchema = z.object({
  tags: z.array(z.enum(TAGS)),
  user: z.string().min(1).nullable(),
  from: z.iso.date().nullable(),
  to: z.iso.date().nullable(),
});
export type FeedFilters = z.infer<typeof feedFiltersSchema>;

export type RawFeedFilters = Record<string, string | string[] | undefined>;

const TAG_SET: ReadonlySet<string> = new Set(TAGS);
const isoDateSchema = z.iso.date();

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

function parseDateOnly(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return isoDateSchema.safeParse(trimmed).success ? trimmed : null;
}

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

export interface FilterableMessage {
  tag: Tag;
  createdAt: string;
  author: { id: string };
}

const DAY_MS = 24 * 60 * 60 * 1000;

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
