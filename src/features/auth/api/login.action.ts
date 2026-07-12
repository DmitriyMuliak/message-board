'use server';

import { z } from 'zod';
import { cookies } from 'next/headers';

import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  signSession,
} from '@/server/auth-service';
import { verifyCredentials } from '@/server/credentials-service';
import { simulateLatency } from '@/server/simulate';

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export type LoginActionState = { success: true } | { success: false; error: string; code?: string };

export async function loginAction(data: unknown): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: 'Email and password are required.', code: 'VALIDATION' };
  }

  await simulateLatency();

  const user = verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user) {
    return { success: false, error: 'Incorrect email or password.', code: 'INVALID_CREDENTIALS' };
  }

  const token = await signSession(user.id);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });

  return { success: true };
}
