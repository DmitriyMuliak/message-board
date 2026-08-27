'use client';

import { useQuery } from '@tanstack/react-query';

import type { AuthorProfile } from '../model/types';

export const authorKeys = {
  all: ['author'] as const,
  byId: (id: string) => [...authorKeys.all, id] as const,
};

/**
 * The component's single fetch-on-mount.
 *
 * Reads go over HTTP, so the kit substitutes them with MSW — no port needed.
 * A port is for things that are NOT a request: a server action, the clock,
 * randomness, a feature flag.
 */
export function useAuthorQuery(authorId: string) {
  return useQuery({
    queryKey: authorKeys.byId(authorId),
    queryFn: async (): Promise<AuthorProfile> => {
      const response = await fetch(`/api/authors/${authorId}`);
      if (!response.ok) throw new Error('Failed to load author');
      return response.json();
    },
  });
}
