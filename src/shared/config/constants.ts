/**
 * App-wide constants that double as part of the API contract.
 *  Kept dependency-free and framework-agnostic so both
 * `src/server` and client code can import them without pulling in anything
 * else.
 */

/** Order here is also the canonical sort
 * order used when normalizing/serializing the `tags` URL filter. */
export const TAGS = ['PRODUCT', 'DESIGN', 'RANDOM', 'ANNOUNCE'] as const;

export type Tag = (typeof TAGS)[number];

/**
 * Cursor-pagination page size: `default` is used when a request omits
 * `limit`, `max` is the hard ceiling a request can ask for regardless of
 * what it passes — both enforced by the mock `GET /api/messages` handler.
 */
export const PAGE_SIZE = {
  default: 20,
  max: 50,
} as const;
