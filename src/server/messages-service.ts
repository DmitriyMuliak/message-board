import 'server-only';

import type { ZodError } from 'zod';

import {
  createMessageInputSchema,
  matchesFilters,
  updateMessageInputSchema,
  type FeedFilters,
  type Message,
  type MessagesPage,
} from '@/entities/message';
import { PAGE_SIZE } from '@/shared/config/constants';
import { decodeCursor, encodeCursor } from '@/shared/lib/cursor';
import { db, type DbMessage, type DbUser } from '@/server/db';
import { simulateLatency } from './simulate';

/**
 * Business logic for messages (§6) — the "backend" itself. Route handlers
 * under `app/api/**` are thin adapters over these functions; the Stage-3 SSR
 * feed page calls `listMessages` directly (no HTTP hop). Operates straight
 * on `db.messages` / `db.users` — no separate persistence abstraction, per
 * Stage 1's `db.ts`.
 */

export class MessageValidationError extends Error {
  readonly zodError: ZodError;

  constructor(zodError: ZodError) {
    super(zodError.issues.map((issue) => issue.message).join('; ') || 'Invalid request body.');
    this.name = 'MessageValidationError';
    this.zodError = zodError;
  }
}

export class MessageNotFoundError extends Error {
  constructor(id: string) {
    super(`Message "${id}" was not found.`);
    this.name = 'MessageNotFoundError';
  }
}

export class MessageForbiddenError extends Error {
  constructor() {
    super('You can only modify your own messages.');
    this.name = 'MessageForbiddenError';
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getUserOrThrow(userId: string): DbUser {
  const user = db.users.find((candidate) => candidate.id === userId);
  if (!user) {
    // Data-integrity invariant, not a client-facing error: every message's
    // `authorId` must reference a seeded user, and a requester's id only
    // ever comes from a verified session's `sub` claim. Fail loudly rather
    // than silently render a message with a bogus author.
    throw new Error(`Invariant violation: no user with id "${userId}".`);
  }
  return user;
}

function toMessage(record: DbMessage, requesterId: string): Message {
  const author = getUserOrThrow(record.authorId);
  const isOwner = record.authorId === requesterId;
  return {
    id: record.id,
    content: record.content,
    tag: record.tag,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    author: { id: author.id, name: author.name, handle: author.handle },
    // Backend-driven permissions (§6/§21 row 9): the only place "can this
    // requester edit/delete this message" is decided. No roles system
    // exists yet, so both flags collapse to "is the author" — but callers
    // (including the UI) never compute that comparison themselves.
    permissions: { canEdit: isOwner, canDelete: isOwner },
  };
}

function toFilterable(record: DbMessage) {
  return { tag: record.tag, createdAt: record.createdAt, author: { id: record.authorId } };
}

function clampLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return PAGE_SIZE.default;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), PAGE_SIZE.max);
}

/** True if `a` sorts strictly before `b` under the store's stable order,
 * `(createdAt DESC, id DESC)` (mirrors `db.ts`'s internal seed comparator,
 * re-derived here since it isn't exported — `db.ts` only exports the data
 * and `reseedDb`, not its seeding internals). */
function sortsBefore(
  a: { createdAt: string; id: string },
  b: { createdAt: string; id: string },
): boolean {
  if (a.createdAt !== b.createdAt) {
    return a.createdAt > b.createdAt;
  }
  return a.id > b.id;
}

/**
 * Inserts a newly-created message keeping `db.messages` sorted, rather than
 * assuming `unshift` is always safe. In practice a new message's `createdAt`
 * is `Date.now()` and therefore newer than everything seeded, so this
 * resolves to index 0 the overwhelming majority of the time — but a naive
 * `unshift` would silently corrupt keyset-pagination ordering in the (rare,
 * single-process-demo-unlikely, but not worth leaving as a latent bug)
 * event of a same-millisecond `createdAt` collision.
 */
function insertMessageSorted(record: DbMessage): void {
  const index = db.messages.findIndex((existing) => sortsBefore(record, existing));
  if (index === -1) {
    db.messages.push(record);
  } else {
    db.messages.splice(index, 0, record);
  }
}

/** Position of `m` relative to a decoded cursor under the store's
 * `(createdAt DESC, id DESC)` order: positive once `m` comes strictly after
 * the cursor, i.e. belongs on the next page. */
function comparePosition(
  m: { createdAt: string; id: string },
  cursor: { createdAt: string; id: string },
): number {
  if (m.createdAt !== cursor.createdAt) {
    return m.createdAt < cursor.createdAt ? 1 : -1;
  }
  if (m.id !== cursor.id) {
    return m.id < cursor.id ? 1 : -1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Queries / mutations
// ---------------------------------------------------------------------------

export async function listMessages(
  requesterId: string,
  filters: FeedFilters,
  cursor: string | null,
  limit?: number,
): Promise<MessagesPage> {
  await simulateLatency();

  const filtered = db.messages.filter((record) => matchesFilters(toFilterable(record), filters));
  const total = filtered.length;
  const effectiveLimit = clampLimit(limit);

  // An undecodable cursor degrades to "start of the feed" instead of
  // erroring — mirrors `decodeCursor`'s own documented degrade path (never
  // throws; callers decide how to treat a malformed/tampered value).
  const cursorPayload = cursor ? decodeCursor(cursor) : null;
  const startIndex = (() => {
    if (!cursorPayload) {
      return 0;
    }
    const idx = filtered.findIndex((record) => comparePosition(record, cursorPayload) > 0);
    return idx === -1 ? filtered.length : idx;
  })();

  const page = filtered.slice(startIndex, startIndex + effectiveLimit);
  // By construction (derived from the same `hasMore` check), `nextCursor`
  // and `hasMore` can never disagree — the "stay consistent on the last
  // page" contract requirement holds trivially rather than by convention.
  const hasMore = startIndex + effectiveLimit < total;
  const nextCursor = hasMore
    ? encodeCursor({
        createdAt: page[page.length - 1].createdAt,
        id: page[page.length - 1].id,
      })
    : null;

  return {
    items: page.map((record) => toMessage(record, requesterId)),
    nextCursor,
    hasMore,
    // total, // keep for another example
  };
}

/**
 * Creates a message on behalf of `requesterId`. `input` is the raw,
 * not-yet-validated request body — validation against
 * `createMessageInputSchema` happens here (throws {@link MessageValidationError}
 * on failure), not in the route handler, so the service is the single place
 * that decides what a valid message looks like.
 *
 * The client-generated `id` doubles as an idempotency key (§6/§21 row 10):
 * if a message with that id already exists, it's returned as-is — no error,
 * no duplicate — so a retried `POST` (e.g. after a dropped response) is
 * always safe.
 */
export async function createMessage(requesterId: string, input: unknown): Promise<Message> {
  await simulateLatency();

  const parsed = createMessageInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new MessageValidationError(parsed.error);
  }

  const existing = db.messages.find((record) => record.id === parsed.data.id);
  if (existing) {
    return toMessage(existing, requesterId);
  }

  const record: DbMessage = {
    id: parsed.data.id,
    content: parsed.data.content,
    tag: parsed.data.tag,
    authorId: requesterId,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  insertMessageSorted(record);
  return toMessage(record, requesterId);
}

/**
 * Updates a message's `content` and/or `tag`. Checks existence before
 * ownership before payload shape — in that order — so a non-author probing
 * a message they don't own always gets `403` regardless of what (possibly
 * malformed) body they sent, and a request against a message that doesn't
 * exist at all always gets `404` (you can't be "not the author" of nothing).
 */
export async function updateMessage(
  requesterId: string,
  id: string,
  input: unknown,
): Promise<Message> {
  await simulateLatency();

  const record = db.messages.find((candidate) => candidate.id === id);
  if (!record) {
    throw new MessageNotFoundError(id);
  }
  if (record.authorId !== requesterId) {
    throw new MessageForbiddenError();
  }

  const parsed = updateMessageInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new MessageValidationError(parsed.error);
  }

  if (parsed.data.content !== undefined) {
    record.content = parsed.data.content;
  }
  if (parsed.data.tag !== undefined) {
    record.tag = parsed.data.tag;
  }
  record.updatedAt = new Date().toISOString();

  return toMessage(record, requesterId);
}

/** Same existence-then-ownership precedence as {@link updateMessage}. */
export async function deleteMessage(requesterId: string, id: string): Promise<void> {
  await simulateLatency();

  const index = db.messages.findIndex((candidate) => candidate.id === id);
  if (index === -1) {
    throw new MessageNotFoundError(id);
  }
  if (db.messages[index].authorId !== requesterId) {
    throw new MessageForbiddenError();
  }
  db.messages.splice(index, 1);
}
