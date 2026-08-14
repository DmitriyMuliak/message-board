import { Skeleton } from '@/shared/ui/Skeleton';
import { FeedSkeleton } from '@/views/feed';

const GRID_CLASSNAME =
  'mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-8 px-4 py-8 lg:grid lg:grid-cols-[296px_1fr] lg:px-8';

function FilterBarSkeleton() {
  return (
    <div className="hidden lg:flex flex-col gap-6" aria-hidden="true">
      <Skeleton width={120} height={20} />
      <Skeleton width="100%" height={90} />
      <Skeleton width="100%" height={46} />
      <Skeleton width="100%" height={104} />
    </div>
  );
}

export default function Loading() {
  return (
    <div className={GRID_CLASSNAME} aria-hidden="true">
      <FilterBarSkeleton />
      <main className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-4 border-[3px] border-ink bg-paper p-[18px] shadow-brutal-6">
          <Skeleton width="100%" height={64} />
          <div className="mt-1.5 flex items-center justify-between border-t-2 border-base pt-3.5">
            <Skeleton width={100} height={38} />
            <div className="flex items-center gap-4">
              <Skeleton width={40} height={16} />
              <Skeleton width={80} height={42} />
            </div>
          </div>
        </div>
        <FeedSkeleton />
      </main>
    </div>
  );
}
