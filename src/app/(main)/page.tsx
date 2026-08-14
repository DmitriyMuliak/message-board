import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { messageKeys } from '@/entities/message';
import { normalizeFilters, type RawFeedFilters } from '@/features/feed-filters';
import { listMessages } from '@/server/messages-service';
import { requireSession } from '@/server/require-session';
import { FeedView } from '@/views/feed';
import { PAGE_SIZE } from '@/shared/config/constants';

import { createAppQueryClient } from '../query-client';

interface FeedPageProps {
  searchParams: Promise<RawFeedFilters>;
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const { userId } = await requireSession();
  const filters = normalizeFilters(await searchParams);

  const queryClient = createAppQueryClient();

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
