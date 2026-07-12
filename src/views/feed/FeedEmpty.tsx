import { cn } from '@/shared/lib/cn';

const HATCH_BACKGROUND =
  'repeating-linear-gradient(45deg, var(--color-base-soft), var(--color-base-soft) 10px, var(--color-base) 10px, var(--color-base) 20px)';

export function FeedEmpty() {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center border-[3px] border-dashed border-ink p-10 text-center',
      )}
      style={{ backgroundImage: HATCH_BACKGROUND }}
    >
      <div
        aria-hidden="true"
        className="flex h-14 w-14 md:h-[72px] md:w-[72px] items-center justify-center border-[3px] border-ink bg-accent font-sans text-[28px] md:text-[34px] font-bold text-ink shadow-brutal-3 md:shadow-brutal-4"
      >
        !
      </div>
      <h2 className="mt-[18px] md:mt-6 font-sans text-[19px] md:text-2xl font-bold text-ink">
        Nothing here yet
      </h2>
      <p className="mt-2 max-w-[360px] font-sans text-xs md:text-sm text-muted">
        No messages match this view. Post the first one, or <span>clear your filters.</span>
      </p>
    </div>
  );
}
