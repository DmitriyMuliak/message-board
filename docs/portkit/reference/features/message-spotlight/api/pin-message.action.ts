'use server';

import { z } from 'zod';

import { getSession } from '@/server/auth-service';
import { pinMessage } from '@/server/social-service';
import type { PinMessageState } from '../model/types';

const pinSchema = z.object({ messageId: z.string().trim().min(1) });

export async function pinMessageAction(data: unknown): Promise<PinMessageState> {
  const parsed = pinSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'A message is required.', code: 'VALIDATION' };
  }

  const session = await getSession();
  if (!session) {
    return {
      success: false,
      error: 'You must be logged in to pin messages.',
      code: 'UNAUTHORIZED',
    };
  }

  pinMessage(session.userId, parsed.data.messageId);
  return { success: true };
}
