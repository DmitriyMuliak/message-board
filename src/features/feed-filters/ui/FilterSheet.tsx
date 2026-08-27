'use client';

import dynamic from 'next/dynamic';
import { Dialog } from 'radix-ui';

import { EMPTY_FILTERS, type FeedFilters } from '@/entities/message';
import { TAGS, type Tag } from '@/shared/config/constants';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Skeleton';

import { UserSelect } from './UserSelect';

const DateRangePicker = dynamic(
  () => import('@/shared/ui/DateRangePicker').then((mod) => mod.DateRangePicker),
  { ssr: false, loading: () => <Skeleton width="100%" height={104} /> },
);

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FeedFilters;
  setFilters: (next: FeedFilters) => void;
}

function toggleTag(filters: FeedFilters, setFilters: (next: FeedFilters) => void, tag: Tag) {
  const nextTags = filters.tags.includes(tag)
    ? filters.tags.filter((candidate) => candidate !== tag)
    : [...filters.tags, tag];
  setFilters({ ...filters, tags: nextTags });
}

export function FilterSheet({ open, onOpenChange, filters, setFilters }: FilterSheetProps) {
  function handleClearAll() {
    setFilters(EMPTY_FILTERS);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-none',
            'border-t-[3px] border-ink bg-paper p-5 outline-none',
          )}
        >
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-mono text-sm font-bold tracking-wide text-ink uppercase">
              Filters
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Filter messages by tag, user, or date range.
            </Dialog.Description>
            <Dialog.Close asChild></Dialog.Close>
          </div>

          <div className="mt-5 flex flex-col gap-5">
            <section>
              <h3 className="mb-2.5 font-mono text-xs font-bold tracking-wide text-muted uppercase">
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
            </section>

            <section>
              <h3 className="mb-2.5 font-mono text-xs font-bold tracking-wide text-muted uppercase">
                User
              </h3>
              <UserSelect
                value={filters.user}
                onChange={(user) => setFilters({ ...filters, user })}
              />
            </section>

            <section>
              <h3 className="mb-2.5 font-mono text-xs font-bold tracking-wide text-muted uppercase">
                Date
              </h3>
              <DateRangePicker
                value={{ from: filters.from, to: filters.to }}
                onChange={({ from, to }) => setFilters({ ...filters, from, to })}
              />
            </section>
          </div>

          <div className="mt-6 flex items-center justify-between border-t-2 border-base pt-4">
            <Button variant="ghost" onClick={handleClearAll}>
              Clear
            </Button>
            <Dialog.Close asChild>
              <Button type="button" variant="accent" shadow={4}>
                DONE
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
