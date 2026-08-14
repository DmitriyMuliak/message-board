import { Avatar } from '@/shared/ui/Avatar';
import { Card } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { RelativeTime } from '@/shared/ui/RelativeTime';

import type { Message } from '../model/types';

/**
 * Part of `@/entities/message`'s public API — the `@public` tag that tells knip
 * so sits on the re-export in `../index.ts`, where knip attributes the export.
 *
 * `actions` is a slot: this card is built to be wrapped by an upper layer
 * (`widgets/message-card` does), so the shape it accepts is a promise the entity
 * makes rather than an internal detail. Kept exported for that reason alone —
 * see the note above the export in `../index.ts`.
 */
export interface MessageCardProps {
  message: Message;
  activeTagFilter?: boolean;
  activeImage?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export function MessageCard({
  message,
  activeTagFilter = false,
  activeImage = false,
  actions,
  className,
}: MessageCardProps) {
  const authorHeadingId = `message-author-${message.id}`;

  return (
    <article aria-labelledby={authorHeadingId} className={className}>
      <Card className="flex flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar name={message.author.name} variant={activeImage ? 'self' : 'other'} size={34} />
            <div>
              <h3
                id={authorHeadingId}
                className="hidden md:block font-sans text-sm md:text-[15px] font-bold text-ink leading-tight"
              >
                {message.author.name}
              </h3>
              <div className="font-sans text-xs text-muted mt-0.5">@{message.author.handle}</div>
            </div>
          </div>
          <RelativeTime
            createdAt={message.createdAt}
            className="font-sans text-[11px] md:text-xs text-muted"
          />
        </header>

        <p className="mt-3.5 whitespace-pre-wrap break-words font-sans text-sm md:text-[16px] leading-[1.5] text-ink">
          {message.content}
        </p>

        <footer className="mt-4 flex items-center justify-between">
          <Chip
            isButton={false}
            active={activeTagFilter}
            tabIndex={-1}
            className="cursor-default px-2 py-[3px] md:px-2.5 md:py-1"
          >
            {message.tag}
          </Chip>
          {actions}
        </footer>
      </Card>
    </article>
  );
}
