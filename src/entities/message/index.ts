/**
 * Public API of the `message` entity.
 *
 * Everything outside this slice imports from `@/entities/message` and nothing
 * else — the `no-restricted-imports` rule in `eslint.config.mjs` makes a deep
 * import (`@/entities/message/ui/MessageCard`) a lint error. That is what makes
 * the file layout below an implementation detail: moving `MessageCard` to
 * another segment changes this file and no call sites.
 */

export {
  messageSchema,
  createMessageInputSchema,
  updateMessageInputSchema,
  type Message,
  type MessagesPage,
  type CreateMessageInput,
  type UpdateMessageInput,
} from './model/types';

export {
  feedFiltersSchema,
  serializeFilters,
  matchesFilters,
  EMPTY_FILTERS,
  type FeedFilters,
} from './model/filters';

export { messageKeys, messageListQueryDefaults } from './api/queries';
export { useMessagesInfinite } from './api/useMessagesInfinite';

// These two are the only `*Props` in the app's public APIs, because these are
// the only two components an upper layer is *meant* to compose — see the
// `@public` note at each declaration. Elsewhere a Props type stays inside its
// module: a consumer that needs one derives it with
// `React.ComponentProps<typeof X>`, which costs the slice no promise.
/** @public — `MessageCardProps`: unimported today, promised on purpose. */
export { MessageCard, type MessageCardProps } from './ui/MessageCard';
/** @public — `TagSelectProps`: unimported today, promised on purpose. */
export { TagSelect, type TagSelectProps } from './ui/TagSelect';
