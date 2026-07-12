'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';

import type { FeedFilters } from '@/features/feed-filters/model/filters';
import type { Message } from '@/entities/message/model/types';
import type { Tag } from '@/shared/config/constants';
import { cn } from '@/shared/lib/cn';

import { MessageCardWithActions } from '@/entities/message/ui/MessageCardWithActions';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Median measured card height (182–230px observed), incl. the `pb-4` gap.
 * Only affects the scrollbar for rows not yet measured — real heights come
 * from `measureElement` once a row mounts. */
const ESTIMATED_ROW_HEIGHT = 200;
const OVERSCAN = 6;

export interface MessageListProps {
  items: Message[];
  activeTags?: readonly Tag[];
  filters: FeedFilters;
  isFetching?: boolean;
  className?: string;
}

export function MessageList({
  items,
  activeTags,
  filters,
  isFetching,
  className,
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [isVirtualized, setIsVirtualized] = useState(false);

  useIsomorphicLayoutEffect(() => {
    function measure() {
      setScrollMargin(listRef.current?.offsetTop ?? 0);
    }
    measure();
    setIsVirtualized(true);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const activeTagSet = activeTags && activeTags.length > 0 ? new Set(activeTags) : null;

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => items[index].id,
    scrollMargin,
  });

  // Before mount the virtualizer has no viewport rect and no measured rows, so
  // it would place absolute rows at `ESTIMATED_ROW_HEIGHT` offsets — shorter
  // than real cards, which overlap as a result. Rendering in normal flow keeps
  // the server HTML correct on its own; the swap to virtualized rows happens in
  // the same commit as hydration, before paint.
  if (!isVirtualized) {
    return (
      <div
        ref={listRef}
        role="feed"
        aria-busy={isFetching || undefined}
        className={cn('w-full', className)}
      >
        {items.map((item) => (
          <MessageCardWithActions
            key={item.id}
            message={item}
            activeTagFilter={activeTagSet?.has(item.tag) ?? false}
            filters={filters}
            className="pb-4"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      role="feed"
      aria-busy={isFetching || undefined}
      className={cn('relative w-full', className)}
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const item = items[virtualRow.index];
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full"
            style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
          >
            <MessageCardWithActions
              message={item}
              activeTagFilter={activeTagSet?.has(item.tag) ?? false}
              filters={filters}
              className="pb-4"
            />
          </div>
        );
      })}
    </div>
  );
}
