/**
 * Same rule as the author-card feature: the write's RESULT TYPE lives here, not
 * in the `'use server'` module, so the port can describe the operation without
 * importing the action.
 */
export interface Spotlight {
  id: string;
  body: string;
  authorId: string;
  pinned: boolean;
}

export type PinMessageState = { success: true } | { success: false; error: string; code?: string };
