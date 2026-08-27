/** Public API of the `feed-filters` feature: read filters from the URL, write
 * them back, and the controls that do it. The filter *contract* itself belongs
 * to `@/entities/message` — see the note in `entities/message/model/filters.ts`. */

export { useFeedFilters } from './lib/useFeedFilters';
export { normalizeFilters, type RawFeedFilters } from './lib/normalizeFilters';
export { FilterBar, MobileFilterBar } from './ui/FilterBar';
