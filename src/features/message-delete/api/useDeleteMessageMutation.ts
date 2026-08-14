'use client';

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { messageKeys, type FeedFilters, type MessagesPage } from '@/entities/message';
import { apiService, ApiError } from '@/shared/api/http-client';
import { apiRoutes } from '@/shared/api/routes';
import { useToast } from '@/shared/ui/Toaster';

/**
 * Optimistic delete mutation.
 * Flow:
 * 1. `onMutate`: cancel queries, snapshot, filter the row out of every page.
 * 2. `onSuccess`: confirm deletion, let the optimistic state stick.
 * 3. `onError`: restore snapshot so the row reappears.
 */
export function useDeleteMessageMutation(filters: FeedFilters) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiService<void>(apiRoutes.messages.byId(id), {
        method: 'DELETE',
      });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: messageKeys.list(filters) });

      const previousData = queryClient.getQueryData<InfiniteData<MessagesPage, string | null>>(
        messageKeys.list(filters),
      );

      if (previousData) {
        queryClient.setQueryData<InfiniteData<MessagesPage, string | null>>(
          messageKeys.list(filters),
          {
            pageParams: previousData.pageParams,
            pages: previousData.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.id !== id),
            })),
          },
        );
      }

      return { previousData };
    },
    onSuccess: () => {
      // Deletion confirmed; let the optimistic state (row filtered out) stick.
      // Invalidate for consistency.
      // `messageKeys.all`, not just the current filter key: every *other* cached
      // filter combination still holds the pre-mutation list, and would serve it
      // from cache for `staleTime` (30s) — a message you just deleted would
      // reappear when you cleared the filter. `invalidateQueries` only *marks*
      // them stale (default `refetchType: 'active'`), so the one mounted query
      // refetches and the rest simply refetch when next subscribed. Cheap.
      queryClient.invalidateQueries({
        queryKey: messageKeys.all,
      });
    },
    onError: (error, _variables, context) => {
      // Restore the snapshot so the row reappears.
      if (context?.previousData) {
        queryClient.setQueryData(messageKeys.list(filters), context.previousData);
      }

      const message =
        error instanceof ApiError && error.status === 403
          ? 'You can only delete your own messages'
          : "Couldn't delete — please try again.";

      addToast({
        message,
        variant: 'error',
        duration: null,
      });
    },
  });
}
