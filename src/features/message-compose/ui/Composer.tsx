'use client';

import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { createMessageInputSchema, TagSelect, type FeedFilters } from '@/entities/message';
import { TAGS } from '@/shared/config/constants';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Textarea } from '@/shared/ui/Textarea';

import { useCreateMessageMutation } from '../api/useCreateMessageMutation';

interface ComposerProps {
  filters: FeedFilters;
  className?: string;
}

interface ComposerFormData {
  content: string;
  tag: (typeof TAGS)[number];
}

export function Composer({ filters, className }: ComposerProps) {
  const mutation = useCreateMessageMutation(filters);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ComposerFormData>({
    resolver: zodResolver(createMessageInputSchema.pick({ content: true, tag: true })),
    defaultValues: {
      tag: TAGS[0],
      content: '',
    },
    mode: 'onSubmit',
  });

  const content = useWatch({ control, name: 'content', exact: true }) ?? '';
  const tag = useWatch({ control, name: 'tag', exact: true }) ?? TAGS[0];

  const charCount = content.trim().length;
  const isValid = charCount > 0 && charCount <= maxContentLength;
  const isOversized = charCount > maxContentLength;
  const isSending = mutation.isPending;

  // Only reached once the zod resolver passes, so an empty or oversized message never
  // gets here: `handleSubmit` short-circuits and fills `errors.content` instead. That
  // is what lets POST stay enabled (as the spec draws it) without costing a request.
  const handleSubmitForm = async (data: ComposerFormData) => {
    if (!isValid || isSending) {
      return;
    }

    const id = crypto.randomUUID();

    await mutation.mutateAsync({
      id,
      content: data.content,
      tag: data.tag,
    });

    // Clear the composer on success (optimistic feedback already happened).
    reset();
  };

  return (
    <Card className={cn('shadow-brutal-6', className)}>
      <form onSubmit={handleSubmit(handleSubmitForm)} className="flex flex-col">
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              id="composer-content"
              label="Message"
              hideLabel
              placeholder="What's happening?"
              disabled={isSending}
              error={errors.content?.message}
              containerClassName="relative"
              errorClass="absolute bottom-0"
              className="min-h-16 max-h-16 text-[15px] md:text-[16px] md:max-h-18"
            />
          )}
        />
        <div className="mt-1.5 flex items-center justify-between border-t-2 border-base pt-3.5">
          <TagSelect value={tag} onChange={(next) => setValue('tag', next)} disabled={isSending} />

          <div className="flex items-center gap-4">
            <span
              className={cn(
                'font-mono text-xs',
                charCount === 0 ? 'text-muted' : isOversized ? 'font-bold text-ink' : 'text-faint',
              )}
              aria-live="polite"
              role="status"
            >
              {charCount}/{maxContentLength}
            </span>
            <Button
              type="submit"
              shadow={3}
              disabled={isSending || isOversized}
              aria-busy={isSending}
              aria-label={isSending ? 'Posting...' : undefined}
              className="h-[42px] text-[13px] md:text-sm relative"
            >
              POST
              {isSending && (
                <span
                  aria-hidden="true"
                  className="size-1.5 animate-pulse rounded-full bg-current absolute right-[5px] center"
                />
              )}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

const maxContentLength = 240;
