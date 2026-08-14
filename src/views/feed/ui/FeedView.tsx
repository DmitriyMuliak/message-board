'use client';

import { Suspense } from 'react';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';

import { serializeFilters, useMessagesInfinite, type FeedFilters } from '@/entities/message';
import { FilterBar, MobileFilterBar, useFeedFilters } from '@/features/feed-filters';
import { Composer } from '@/features/message-compose';
import { PAGE_SIZE } from '@/shared/config/constants';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

import { FeedEmpty } from './FeedEmpty';
import { FeedError } from './FeedError';
import { FeedSkeleton } from './FeedSkeleton';
import { LoadMoreButton } from './LoadMoreButton';
import { MessageList } from './MessageList';

interface FeedViewProps {
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
  const { reset } = useQueryErrorResetBoundary();

  return (
    <div className={GRID_CLASSNAME}>
      <FilterBar />
      <main className="flex min-w-0 flex-1 flex-col gap-6">
        <Composer filters={filters} />
        <MobileFilterBar />
        {/* Scoped to the list, not the page: a failed fetch must not take the
            composer and the filter bar down with it, and RETRY has to refetch
            in place. Changing filters clears the error on its own — a new
            filter set is a new request, and the old failure no longer applies. */}
        <ErrorBoundary
          onReset={reset}
          resetKeys={[serializeFilters(filters)]}
          fallback={({ error, reset: retry }) => (
            <FeedError onRetry={retry} message={error.message} />
          )}
        >
          <Suspense fallback={<FeedSkeleton />}>
            <FeedMessages filters={filters} />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function FeedMessages({ filters }: { filters: FeedFilters }) {
  // A suspense query has no error branch to render: `throwOnError` defaults to
  // `true`, so a failure throws to the `<ErrorBoundary>` above rather than
  // returning `isError`.
  const query = useMessagesInfinite(filters, LIMIT);

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
