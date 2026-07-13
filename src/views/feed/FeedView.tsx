'use client';

import { Suspense } from 'react';

import { useMessagesInfinite } from '@/entities/message/api/useMessagesInfinite';
import { FilterBar, MobileFilterBar } from '@/features/feed-filters/ui/FilterBar';
import { useFeedFilters } from '@/features/feed-filters/lib/useFeedFilters';
import { Composer } from '@/features/message-compose/ui/Composer';
import type { FeedFilters } from '@/features/feed-filters/model/filters';
import { PAGE_SIZE } from '@/shared/config/constants';

import { FeedEmpty } from './FeedEmpty';
import { FeedError } from './FeedError';
import { FeedSkeleton } from './FeedSkeleton';
import { LoadMoreButton } from './LoadMoreButton';
import { MessageList } from './MessageList';

export interface FeedViewProps {
  className?: string;
}

const LIMIT = PAGE_SIZE.default;

export function FeedView({ className }: FeedViewProps) {
  return (
    <div className={className}>
      <Suspense fallback={<FeedViewFallback />}>
        <FeedViewInner />
      </Suspense>
    </div>
  );
}

function FeedViewInner() {
  const { filters } = useFeedFilters();

  return (
    <div className={GRID_CLASSNAME}>
      <FilterBar />
      <main className="flex min-w-0 flex-1 flex-col gap-6">
        <Composer filters={filters} />
        <MobileFilterBar />
        <Suspense fallback={<FeedSkeleton />}>
          <FeedMessages filters={filters} />
        </Suspense>
      </main>
    </div>
  );
}

function FeedMessages({ filters }: { filters: FeedFilters }) {
  const query = useMessagesInfinite(filters, LIMIT);

  if (query.isError) {
    return <FeedError onRetry={query.refetch} message={query.error?.message} />;
  }

  const items = query.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return <FeedEmpty />;
  }

  return (
    <>
      <MessageList
        items={items}
        activeTags={filters.tags}
        filters={filters}
        isFetching={query.isFetching}
      />
      <LoadMoreButton
        onClick={query.fetchNextPage}
        isLoading={query.isFetchingNextPage}
        hasMore={query.hasNextPage ?? false}
      />
    </>
  );
}

function FeedViewFallback() {
  return (
    <div className={GRID_CLASSNAME} aria-hidden="true">
      <FilterBar />
      <main className="flex min-w-0 flex-1 flex-col gap-6">
        <FeedSkeleton />
      </main>
    </div>
  );
}

const GRID_CLASSNAME =
  'mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-8 px-4 py-8 lg:grid lg:grid-cols-[296px_1fr] lg:px-8';
