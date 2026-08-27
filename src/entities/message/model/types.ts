import { z } from 'zod';
import { TAGS } from '@/shared/config/constants';

export const messageSchema = z.object({
  id: z.uuid(),
  content: z
    .string()
    .trim()
    .min(1, 'Write something before posting.')
    .max(240, 'Message is too long — 240 characters max.'),
  tag: z.enum(TAGS),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
  author: z.object({ id: z.string(), name: z.string(), handle: z.string() }),
  permissions: z.object({ canEdit: z.boolean(), canDelete: z.boolean() }),
});
export type Message = z.infer<typeof messageSchema>;

/**
 * The paginated feed response. Declared, not `z.infer`red like its three
 * neighbours, because this shape is the only one nothing ever parses: the client
 * reads a page through `apiService<MessagesPage>()`. A zod object here would be
 * a value whose only job is to be `typeof`'d — and, exported, a public schema
 * that validates nothing. `items: Message[]` keeps it tied to `messageSchema`
 * regardless.
 */
export interface MessagesPage {
  items: Message[];
  /** Opaque `base64(createdAt|id)`, `null` on the last page. */
  nextCursor: string | null;
  hasMore: boolean; // handy, can be formed from nextCursor
}

export const createMessageInputSchema = messageSchema.pick({
  id: true,
  content: true,
  tag: true,
});
export type CreateMessageInput = z.infer<typeof createMessageInputSchema>;

export const updateMessageInputSchema = messageSchema
  .pick({ content: true, tag: true })
  .partial()
  .refine((data) => data.content !== undefined || data.tag !== undefined, {
    message: 'Provide at least one of content or tag to update.',
  });
export type UpdateMessageInput = z.infer<typeof updateMessageInputSchema>;
