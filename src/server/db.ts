import 'server-only';

import { TAGS, type Tag } from '@/shared/config/constants';
import { mulberry32 } from './seeded-rng';

/**
 * In-memory mock database (§6). Deterministic seed (fixed PRNG seed) so the
 * feed is reproducible across dev restarts and meaningful for the
 * virtualization/pagination demo. `globalThis`-cached so a dev-mode HMR
 * reload of this module reuses the same data instead of reseeding (and
 * discarding anything created/edited/deleted during the session).
 *
 * Normalized on purpose (`messages` reference `authorId`, not an embedded
 * author object) to mirror a real backend's users/messages tables —
 * `messages-service.ts` (Stage 2) joins `author` and computes
 * `permissions` per requester when it builds the public `Message` shape.
 */

export interface DbUser {
  id: string;
  name: string;
  handle: string;
  email: string;
}

export interface DbMessage {
  id: string;
  content: string;
  tag: Tag;
  authorId: string;
  createdAt: string; // ISO-8601 UTC
  updatedAt: string | null;
}

export interface Db {
  users: DbUser[];
  /** Stable-sorted `(createdAt DESC, id DESC)` — the sort the keyset cursor
   * (`src/shared/lib/cursor.ts`) is defined over. */
  messages: DbMessage[];
}

// Fixed, arbitrary seed — the only requirement is that it never changes,
// so the generated data's *shape* (tag/author distribution, relative
// ordering, content) is reproducible across processes.
const SEED = 20260101;

const MESSAGE_COUNT = 1200;
const SPAN_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

// The 3 spec-named users + 2 invented in the same style (first name, or
// first name + last initial where the first name alone reads ambiguous).
const USERS: readonly DbUser[] = [
  { id: 'u_ada', name: 'Ada Lovelace', handle: 'ada_l', email: 'ada@dispatch.dev' },
  { id: 'u_marco', name: 'Marco Diaz', handle: 'marco', email: 'marco@dispatch.dev' },
  { id: 'u_priya', name: 'Priya Shah', handle: 'priya', email: 'priya@dispatch.dev' },
  { id: 'u_grace', name: 'Grace Hopper', handle: 'grace_h', email: 'grace@dispatch.dev' },
  { id: 'u_leo', name: 'Leo Kim', handle: 'leo', email: 'leo@dispatch.dev' },
];

// Per-tag content bank, deliberately spanning short one-liners to
// near-the-240-char ceiling so seeded data exercises the feed's dynamic
// row-height measurement (§10) instead of every card being the same size.
const CONTENT_BANK: Record<Tag, readonly string[]> = {
  PRODUCT: [
    'Shipped dark mode behind a flag — flip it on in Settings > Experimental before the wider rollout next week.',
    "Heads up: CSV export now streams instead of buffering in memory, so the 50k-row exports won't time out anymore.",
    'Bug fix live: pagination cursors were leaking across accounts on the reports page. Patched and backfilled.',
    'New API rate limit is 600 req/min per key, up from 300. Docs updated.',
    'Onboarding A/B test wraps up Friday — early numbers favor the single-page variant by a solid margin.',
    'Search reindexing finished. Full-text queries should feel noticeably snappier now.',
    'Mobile app v2.3 submitted for review. Changelog: offline drafts, faster cold start, a couple of crash fixes.',
    'Webhook retries now back off exponentially (1s, 2s, 4s… up to 5 attempts) instead of hammering endpoints every second.',
    'Feature flag cleanup day — removed 14 stale flags from the last two quarters. Codebase feels lighter already.',
    'Billing edge case fixed: prorated downgrades were rounding the wrong way. Refunds going out to the ~40 affected accounts today.',
    'Deploy pipeline now runs the smoke suite before promoting to prod, adds about 90 seconds but caught two regressions this month already.',
    'Renamed the "workspace" concept to "team" across the API and UI to match how everyone already talks about it — old field names still accepted for one release.',
  ],
  DESIGN: [
    'Updated the spacing scale to a 4px base grid across the design system — Figma library published.',
    'New empty-state illustrations are in review. Trying to keep them on-brand without being twee.',
    'Contrast pass on the accent yellow: bumped ink to #111 on accent backgrounds, we were right at the WCAG AA line.',
    'Prototyped three variants for the mobile filter sheet. Leaning toward the bottom sheet over a full-screen modal.',
    'Icon set refresh — swapped the outline style for a slightly heavier stroke, reads better at 16px.',
    'Card shadows are gone in the new pass, flat brutalist treatment instead. Feels more confident.',
    'Wrote up the focus-visible spec since the base template ships outline: none everywhere. Accessibility over pixel-fidelity here.',
    'Typography audit done: Space Grotesk for content, Space Mono for UI labels, exactly two families system-wide.',
    'Reworked the avatar component — initials fallback, accent fill for the current user, white for everyone else.',
    "Skeleton loading states now respect prefers-reduced-motion: static blocks instead of a pulse for anyone who's opted out.",
    'Redrew every button state (default, hover, active, disabled, focus-visible) as a single Figma variant set instead of five loose frames — much easier to keep in sync with code now.',
    'Naming convention for tokens is now `color-role-tone` everywhere (e.g. `color-ink-muted`) instead of a mix of three different schemes we had accumulated.',
  ],
  RANDOM: [
    "Coffee machine on 3 is fixed. You're welcome.",
    "Anyone else's calendar just triple-booked this afternoon or is it just me?",
    'Found a stray rubber duck on my desk. Not complaining, just noting it for the record.',
    'Friday trivia is back this week, 4pm, usual channel.',
    'PSA: the fridge on 2 is being cleaned out Thursday, label anything you want to keep.',
    'Just watched a hawk take out a pigeon right outside the window. Nature is metal.',
    'Who keeps leaving the good pens in the kitchen instead of at the desks.',
    'Team lunch order is in, food should land around noon.',
    'Currently losing an argument with a vending machine. Send help or snacks.',
    'Plants on the 4th floor got repotted, they look thrilled about it, or as thrilled as a fern gets.',
    "Ran the numbers: we've collectively spent more time debating the standup time than standups would take at any of the proposed times. Just picking one.",
    'The office playlist somehow looped back to the same lo-fi track four times today. Not mad, just observant.',
  ],
  ANNOUNCE: [
    'All hands moved to Thursday 10am this week only, calendar invites updated.',
    'Welcome to the team, Priya! Starting today on the platform squad.',
    'Office closed Monday for the holiday. Support rotation still covers critical alerts.',
    'Q3 planning doc is open for comments, please add feedback by end of week.',
    'New expense tool goes live Monday, old submissions still process as normal through the transition.',
    'Reminder: performance review self-assessments are due Friday.',
    'We hit 10,000 messages posted on DISPATCH today. Small milestone, take a bow.',
    'Security training renewal is due this month, link in the usual channel.',
    'Building badge access resets tonight for the system migration, re-badge if the door acts up tomorrow.',
    'Congrats to the platform team for closing out the migration two weeks ahead of schedule.',
    'Starting next sprint, RFCs get a mandatory 48-hour comment window before sign-off — goal is fewer surprises at review, not more process for its own sake.',
    'Benefits enrollment window opens the 15th and closes end of month, HR is hosting two Q&A sessions if you want a walkthrough before picking plans.',
  ],
};

function randomInt(rng: () => number, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[randomInt(rng, items.length)];
}

/** UUID-v4-*shaped* id, generated from the seeded RNG rather than
 * `crypto.randomUUID()` so the whole seed — ids included — is reproducible
 * from one fixed seed. `messageSchema`'s `z.uuid()` validates the real
 * UUID structure (version nibble `1-8`, variant nibble `8/9/a/b`), so the
 * version/variant positions are pinned to `4`/`8-b` rather than fully
 * random hex — a naively random hex string only satisfies that regex
 * about 1 time in 8. */
function seededUuid(rng: () => number): string {
  const hex = (length: number) =>
    Array.from({ length }, () => randomInt(rng, 16).toString(16)).join('');
  const variantNibble = '89ab'[randomInt(rng, 4)];
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variantNibble}${hex(3)}-${hex(12)}`;
}

function compareMessagesDesc(a: DbMessage, b: DbMessage): number {
  // ISO-8601 strings sort lexicographically in chronological order.
  if (a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? 1 : -1;
  }
  return a.id < b.id ? 1 : -1;
}

function seed(): Db {
  const rng = mulberry32(SEED);
  const nowMs = Date.now();
  const spanMs = SPAN_DAYS * DAY_MS;

  const messages: DbMessage[] = Array.from({ length: MESSAGE_COUNT }, () => {
    const tag = pick(rng, TAGS);
    const author = pick(rng, USERS);
    const content = pick(rng, CONTENT_BANK[tag]).slice(0, 240).trim();
    const createdAt = new Date(nowMs - randomInt(rng, spanMs)).toISOString();

    return {
      id: seededUuid(rng),
      content,
      tag,
      authorId: author.id,
      createdAt,
      updatedAt: null,
    };
  });

  messages.sort(compareMessagesDesc);

  return {
    users: USERS.map((user) => ({ ...user })),
    messages,
  };
}

declare global {
  // `var` is required here — TypeScript's globalThis augmentation doesn't accept `let`/`const`.
  var __dispatchDb: Db | undefined;
}

globalThis.__dispatchDb ??= seed();

export const db: Db = globalThis.__dispatchDb;

/**
 * Discards all in-memory state and reseeds from scratch. Not used by the
 * app itself (the whole point of the `globalThis` cache is to survive HMR
 * and mutations); exposed for Stage 2's route-handler tests, which will
 * want a clean, deterministic `db` between test cases despite mutating
 * assertions (create/edit/delete) sharing this module-level singleton.
 */
export function reseedDb(): void {
  const fresh = seed();
  db.users = fresh.users;
  db.messages = fresh.messages;
}
