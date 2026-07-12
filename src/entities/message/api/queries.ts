import { serializeFilters, type FeedFilters } from '@/features/feed-filters/model/filters';
import { PAGE_SIZE } from '@/shared/config/constants';

export const messageKeys = {
  all: ['messages'] as const,

  /**
   * The page size is **always** part of the key.
   * A default makes the key impossible to build wrong.
   */
  list: (f: FeedFilters, limit: number = PAGE_SIZE.default) =>
    ['messages', 'list', serializeFilters(f), limit] as const,
};
