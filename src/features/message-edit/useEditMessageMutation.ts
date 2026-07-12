'use client';

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { messageKeys } from '@/entities/message/api/queries';
import { type FeedFilters } from '@/features/feed-filters/model/filters';
import type { Message, MessagesPage, UpdateMessageInput } from '@/entities/message/model/types';
import { apiService, ApiError } from '@/shared/api/http-client';
import { apiRoutes } from '@/shared/api/routes';
import { useToast } from '@/shared/ui/Toaster';

/**
 * Optimistic edit mutation. The user edits a
 * message, clicks SAVE, and the row updates immediately (optimistic).
 *
 * Flow:
 * 1. `onMutate`: cancel queries, snapshot, patch the row in the cache.
 * 2. `onSuccess`: reconcile the server response (same id, no remount).
 * 3. `onError`: restore snapshot, reopen edit mode with attempted text.
 */
export function useEditMessageMutation(filters: FeedFilters) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateMessageInput }) => {
      return apiService<Message>(apiRoutes.messages.byId(id), {
        method: 'PATCH',
        body: input,
      });
    },
    onMutate: async ({ id, input }) => {
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
              items: page.items.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      ...input,
                      optimistic: true,
                    }
                  : item,
              ),
            })),
          },
        );
      }

      return { previousData };
    },
    onSuccess: (data) => {
      // Reconcile the server response with the cached row (same id).
      queryClient.setQueryData<InfiniteData<MessagesPage, string | null>>(
        messageKeys.list(filters),
        (oldData) => {
          if (!oldData) return oldData;
          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (item.id === data.id ? data : item)),
            })),
          };
        },
      );

      // Invalidate for consistency: the server response already reconciled
      // the edited row, so this just ensures freshness if needed later.
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
      if (context?.previousData) {
        queryClient.setQueryData(messageKeys.list(filters), context.previousData);
      }

      const message =
        error instanceof ApiError && error.status === 403
          ? 'You can only edit your own messages'
          : "Couldn't save — please try again.";

      addToast({
        message,
        variant: 'error',
        duration: null,
      });
    },
  });
}
