import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { listMessages } from '@/server/messages-service';
import { normalizeFilters, type RawFeedFilters } from '@/features/feed-filters/model/filters';
import { FeedView } from '@/views/feed/FeedView';
import { messageKeys } from '@/entities/message/api/queries';
import { requireSession } from '@/server/require-session';
import { makeQueryClient } from '@/shared/api/query-client';
import { PAGE_SIZE } from '@/shared/config/constants';

interface FeedPageProps {
  searchParams: Promise<RawFeedFilters>;
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const { userId } = await requireSession();
  const filters = normalizeFilters(await searchParams);

  const queryClient = makeQueryClient();

  queryClient.prefetchInfiniteQuery({
    queryKey: messageKeys.list(filters, PAGE_SIZE.default),
    queryFn: () => listMessages(userId, filters, null, PAGE_SIZE.default),
    initialPageParam: null,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FeedView />
    </HydrationBoundary>
  );
}
