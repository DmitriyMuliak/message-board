/**
 * Domain types — including the RESULT TYPE of the write.
 *
 * `FollowAuthorState` lives here and not in the `'use server'` module on
 * purpose: the port must be able to describe the operation without importing
 * the server action, or every test kit that touches the port drags the whole
 * server graph into jsdom.
 */
export interface AuthorProfile {
  id: string;
  name: string;
  handle: string;
  followers: number;
  isFollowedByViewer: boolean;
}

export type FollowAuthorState =
  { success: true; followers: number } | { success: false; error: string; code?: string };
