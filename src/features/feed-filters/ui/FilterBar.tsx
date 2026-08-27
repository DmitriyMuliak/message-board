'use client';

import dynamic from 'next/dynamic';
import { Suspense, useState } from 'react';

import { EMPTY_FILTERS, type FeedFilters } from '@/entities/message';
import { TAGS, type Tag } from '@/shared/config/constants';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Skeleton';

import { useFeedFilters } from '../lib/useFeedFilters';
import { FilterSheet } from './FilterSheet';
import { UserSelect } from './UserSelect';

const DateRangePicker = dynamic(
  () => import('@/shared/ui/DateRangePicker').then((mod) => mod.DateRangePicker),
  { ssr: false, loading: () => <Skeleton width="100%" height={104} /> },
);

function toggleTag(filters: FeedFilters, setFilters: (next: FeedFilters) => void, tag: Tag) {
  const nextTags = filters.tags.includes(tag)
    ? filters.tags.filter((candidate) => candidate !== tag)
    : [...filters.tags, tag];
  setFilters({ ...filters, tags: nextTags });
}

interface FilterBarProps {
  className?: string;
}

export function FilterBar({ className }: FilterBarProps) {
  return (
    <Suspense fallback={<FilterBarFallback className={className} />}>
      <FilterBarInner className={className} />
    </Suspense>
  );
}

function FilterBarFallback({ className }: { className?: string }) {
  return (
    <div className={cn('hidden flex-col gap-6 lg:flex', className)} aria-hidden="true">
      <Skeleton width={120} height={20} />
      <Skeleton width="100%" height={90} />
      <Skeleton width="100%" height={46} />
      <Skeleton width="100%" height={104} />
    </div>
  );
}

function FilterBarInner({ className }: { className?: string }) {
  const { filters, setFilters } = useFeedFilters();

  const hasAnyActiveFilter =
    filters.tags.length > 0 ||
    filters.user !== null ||
    filters.from !== null ||
    filters.to !== null;

  function handleClearAll() {
    setFilters(EMPTY_FILTERS);
  }

  return (
    // `self-start` is what makes `sticky` work: as a grid item this <aside> would
    // otherwise `align-self: stretch` to the full row height, and a sticky element
    // that already fills its containing block has nowhere to travel.
    <aside className={cn('sticky top-3 hidden flex-col gap-6 self-start lg:flex', className)}>
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-[13px] font-bold tracking-wide text-ink">FILTERS</h2>
        {hasAnyActiveFilter && (
          <button
            type="button"
            onClick={handleClearAll}
            className="cursor-pointer font-sans text-xs text-muted underline  focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            clear
          </button>
        )}
      </div>

      <div>
        <h3 className="mb-2.5 font-mono text-[11px] font-bold tracking-wide text-muted uppercase">
          Tag
        </h3>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => (
            <Chip
              key={tag}
              active={filters.tags.includes(tag)}
              onClick={() => toggleTag(filters, setFilters, tag)}
            >
              {tag}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2.5 font-mono text-[11px] font-bold tracking-wide text-muted uppercase">
          User
        </h3>
        <UserSelect value={filters.user} onChange={(user) => setFilters({ ...filters, user })} />
      </div>

      <div>
        <h3 className="mb-2.5 font-mono text-[11px] font-bold tracking-wide text-muted uppercase">
          Date
        </h3>
        <DateRangePicker
          value={{ from: filters.from, to: filters.to }}
          onChange={({ from, to }) => setFilters({ ...filters, from, to })}
        />
      </div>
    </aside>
  );
}

/**
 * The mobile tag row. A separate export rather than a branch inside `FilterBar`
 * because the spec puts it *between* the composer and the feed, while the desktop
 * sidebar sits in its own grid column — so the two live at different places in the
 * tree, and `FeedView` renders each where it belongs.
 */
export function MobileFilterBar({ className }: FilterBarProps) {
  return (
    <Suspense fallback={null}>
      <MobileFilterBarInner className={className} />
    </Suspense>
  );
}

function MobileFilterBarInner({ className }: { className?: string }) {
  const { filters, setFilters } = useFeedFilters();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className={cn('lg:hidden', className)}>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {TAGS.map((tag) => (
            <Chip
              key={tag}
              active={filters.tags.includes(tag)}
              onClick={() => toggleTag(filters, setFilters, tag)}
            >
              {tag}
            </Chip>
          ))}
        </div>

        <Button
          variant="ghost"
          onClick={() => setSheetOpen(true)}
          aria-label="Open all filters"
          className="relative ml-auto h-8 w-9 shrink-0 border-[2.5px] p-0"
        >
          <span aria-hidden="true">⚙</span>
        </Button>
      </div>

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        filters={filters}
        setFilters={setFilters}
      />
    </div>
  );
}
