'use client';

import { useQuery } from '@tanstack/react-query';

import type { Spotlight } from '../model/types';

export const spotlightKeys = {
  all: ['spotlight'] as const,
  byId: (id: string) => [...spotlightKeys.all, id] as const,
};

export function useSpotlightQuery(messageId: string) {
  return useQuery({
    queryKey: spotlightKeys.byId(messageId),
    queryFn: async (): Promise<Spotlight> => {
      const response = await fetch(`/api/messages/${messageId}/spotlight`);
      if (!response.ok) throw new Error('Failed to load message');
      return response.json();
    },
  });
}
