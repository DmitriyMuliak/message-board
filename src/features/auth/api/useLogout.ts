'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { logoutAction } from './logout.action';

export function useLogout(): () => Promise<void> {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    try {
      await logoutAction();
    } finally {
      queryClient.clear();
      router.push('/auth/login');
    }
  }, [queryClient, router]);
}
