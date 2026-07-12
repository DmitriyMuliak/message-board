'use server';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/server/auth-service';

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
