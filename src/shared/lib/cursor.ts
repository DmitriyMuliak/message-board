/**
 * Opaque keyset-pagination cursor codec (§6). The mock API's stable sort is
 * `(createdAt DESC, id DESC)`, so a cursor only ever needs to capture "the
 * createdAt + id of the last item on the previous page" to resume from
 * there — encoded as `base64(createdAt + '|' + id)`.
 */
export interface CursorPayload {
  createdAt: string;
  id: string;
}

const SEPARATOR = '|';

export function encodeCursor(payload: CursorPayload): string {
  return btoa(`${payload.createdAt}${SEPARATOR}${payload.id}`);
}

/**
 * Decodes a cursor produced by {@link encodeCursor}. Never throws — a
 * malformed/tampered cursor (bad base64, missing separator, empty parts)
 * simply returns `null` so callers can decide how to degrade (e.g. treat
 * it as "no cursor" / start of the feed) instead of the request crashing.
 */
export function decodeCursor(cursor: string): CursorPayload | null {
  let raw: string;
  try {
    raw = atob(cursor);
  } catch {
    return null;
  }

  const separatorIndex = raw.indexOf(SEPARATOR);
  if (separatorIndex === -1) {
    return null;
  }

  const createdAt = raw.slice(0, separatorIndex);
  const id = raw.slice(separatorIndex + 1);
  if (!createdAt || !id) {
    return null;
  }

  return { createdAt, id };
}
