'use client';

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import {
  matchesFilters,
  messageKeys,
  type CreateMessageInput,
  type FeedFilters,
  type Message,
  type MessagesPage,
} from '@/entities/message';
import { useSession } from '@/entities/session';
import { apiService, ApiError } from '@/shared/api/http-client';
import { apiRoutes } from '@/shared/api/routes';
import { useToast } from '@/shared/ui/Toaster';

/**
 * Optimistic create mutation.
 * Flow:
 * 1. `onMutate`: cancel in-flight queries (so a concurrent refetch won't
 *    race with our optimistic update), snapshot the current cache, prepend
 *    an optimistic row to page 0, update query data.
 * 2. Server responds 2xx: `onSuccess` reconciles the response (same id, so
 *    replace the optimistic row with the server version), then invalidates
 *    the list so other people's new messages appear in the background.
 * 3. Server responds non-2xx or times out: `onError` restores the snapshot,
 *    and the toast offers a Retry. The composer's text stays in the input
 *    (never eat user input).
 */
export function useCreateMessageMutation(filters: FeedFilters) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const session = useSession();

  return useMutation({
    mutationFn: async (input: CreateMessageInput) => {
      return apiService<Message>(apiRoutes.messages.base, {
        method: 'POST',
        body: input,
      });
    },
    onMutate: async (input) => {
      // Cancel in-flight queries for the same filter set so they don't race
      // with our optimistic update.
      await queryClient.cancelQueries({ queryKey: messageKeys.list(filters) });

      // Snapshot the old cache state so we can restore it on error.
      const previousData = queryClient.getQueryData<InfiniteData<MessagesPage, string | null>>(
        messageKeys.list(filters),
      );

      // Decide: does this message match the active filters? If not, don't
      // prepend — show "hidden by filters" toast instead.
      // We construct a minimal FilterableMessage just for the predicate check.
      const filterableMessage = {
        tag: input.tag,
        createdAt: new Date().toISOString(),
        author: { id: session.id },
      };
      const wouldBeVisible = matchesFilters(filterableMessage, filters);

      if (wouldBeVisible && previousData) {
        // Prepend an optimistic row to page 0. The optimistic flag
        // disables actions and renders at reduced opacity.
        const optimisticMessage: Message = {
          ...input,
          createdAt: new Date().toISOString(),
          updatedAt: null,
          author: { id: session.id, name: session.name, handle: session.handle },
          permissions: { canEdit: true, canDelete: true },
        };

        queryClient.setQueryData<InfiniteData<MessagesPage, string | null>>(
          messageKeys.list(filters),
          {
            pageParams: previousData.pageParams,
            pages: previousData.pages.map((page, index) =>
              index === 0
                ? {
                    ...page,
                    items: [
                      { ...optimisticMessage, optimistic: true } as Message & {
                        optimistic: boolean;
                      },
                      ...page.items,
                    ],
                  }
                : page,
            ),
          },
        );
      }

      return { previousData, wouldBeVisible };
    },
    onSuccess: (data, _variables, context) => {
      // If the message didn't match filters, don't show it but confirm creation
      if (!context.wouldBeVisible) {
        addToast({
          message: 'Posted — hidden by current filters · Clear filters to see it',
          variant: 'default',
          duration: 5000,
        });
        // Don't invalidate/reconcile — the message wasn't added to the
        // optimistic list anyway.
        return;
      }

      // Reconcile: replace the optimistic row (same id) with the server
      // response, so the virtualizer keeps it in place and React doesn't
      // remount.
      if (context.previousData) {
        queryClient.setQueryData<InfiniteData<MessagesPage, string | null>>(
          messageKeys.list(filters),
          {
            pageParams: context.previousData.pageParams,
            pages: context.previousData.pages.map((page, index) =>
              index === 0
                ? {
                    ...page,
                    items: page.items.map((item) => (item.id === data.id ? data : item)),
                  }
                : page,
            ),
          },
        );
      }

      // Invalidate for consistency: marks the query as stale so it refetches
      // the next time the component subscribes (e.g., on window focus).
      // The optimistic row + server reconcile above already give instant
      // feedback, so not blocking on this refetch.
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
      // Restore the snapshot if we have one.
      if (context?.previousData) {
        queryClient.setQueryData(messageKeys.list(filters), context.previousData);
      }

      const message =
        error instanceof ApiError && error.status === 503
          ? "Couldn't post — the server is busy. Try again?"
          : "Couldn't post — please check your connection and try again.";

      addToast({
        message,
        variant: 'error',
        duration: 5000,
      });
    },
  });
}
