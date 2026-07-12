'use client';

import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';

export interface FeedErrorProps {
  onRetry: () => void;
  message?: string;
  className?: string;
}

const HATCH_BACKGROUND =
  'repeating-linear-gradient(45deg, var(--color-base-soft), var(--color-base-soft) 10px, var(--color-base) 10px, var(--color-base) 20px)';

export function FeedError({ onRetry, message, className }: FeedErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-1 flex-col items-center justify-center border-[3px] border-dashed border-ink p-10 text-center',
        className,
      )}
      style={{ backgroundImage: HATCH_BACKGROUND }}
    >
      <div
        aria-hidden="true"
        className="flex h-[72px] w-[72px] items-center justify-center border-[3px] border-ink bg-accent font-sans text-[34px] font-bold text-ink shadow-brutal-4"
      >
        ✕
      </div>
      <h2 className="mt-6 font-sans text-2xl font-bold text-ink">Couldn&rsquo;t load messages</h2>
      <p className="mt-2 max-w-[360px] font-sans text-sm text-muted">
        {message ?? 'Something went wrong. Check your connection and try again.'}
      </p>
      <Button type="button" variant="ghost" shadow={4} onClick={onRetry} className="mt-6">
        RETRY
      </Button>
    </div>
  );
}
