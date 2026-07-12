'use server';

import { getSession } from '@/server/auth-service';
import { simulateLatency } from '@/server/simulate';
import { listUsers } from '@/server/users-service';

export async function getUsersAction() {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }

  await simulateLatency();

  return { users: listUsers() };
}
