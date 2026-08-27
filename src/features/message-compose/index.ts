/**
 * Public API of the `message-compose` feature.
 *
 * `useCreateMessageMutation` is deliberately *not* here: this slice owns both
 * the mutation and the UI that triggers it, so the only caller is `Composer`
 * next door. Exporting it anyway would promise another slice the right to write
 * to `messageKeys.list(filters)` behind the composer's back. `message-edit` and
 * `message-delete` *do* export theirs, for the opposite reason — their trigger
 * lives in `widgets/message-card`, outside the slice.
 */

export { Composer } from './ui/Composer';
