'use server';

import { z } from 'zod';

import { getSession } from '@/server/auth-service';
import { AuthorNotFoundError, followAuthor } from '@/server/social-service';
import type { FollowAuthorState } from '../model/types';

/**
 * The real implementation of `AuthorPort['follow']`.
 *
 * Note what did NOT change when the port was introduced: the action keeps its
 * validation, its session check and its error mapping. The port did not replace
 * the action — it stopped the *component* from importing it directly.
 */
const followSchema = z.object({ authorId: z.string().trim().min(1) });

export async function followAuthorAction(data: unknown): Promise<FollowAuthorState> {
  const parsed = followSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'An author is required.', code: 'VALIDATION' };
  }

  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: 'You must be logged in to follow people.',
      code: 'UNAUTHORIZED',
    };
  }

  try {
    const profile = followAuthor(session.userId, parsed.data.authorId);
    return { success: true, followers: profile.followers };
  } catch (err) {
    if (err instanceof AuthorNotFoundError) {
      return { success: false, error: 'That account no longer exists.', code: 'NOT_FOUND' };
    }
    throw err;
  }
}
