import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';
import { Skeleton } from '@/shared/ui/Skeleton';

interface SkeletonCardShape {
  nameWidth: number;
  handleWidth: number;
  contentLineWidths: Array<number | string>;
}

const CARD_SHAPES: SkeletonCardShape[] = [
  { nameWidth: 140, handleWidth: 90, contentLineWidths: ['100%', '80%'] },
  { nameWidth: 120, handleWidth: 80, contentLineWidths: ['95%', '60%'] },
  { nameWidth: 130, handleWidth: 70, contentLineWidths: ['88%'] },
];

export interface FeedSkeletonProps {
  count?: number;
  className?: string;
}

export function FeedSkeleton({ count = 3, className }: FeedSkeletonProps) {
  return (
    <div className={cn('flex flex-col gap-5', className)} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => {
        const shape = CARD_SHAPES[index % CARD_SHAPES.length];
        return (
          <Card key={index}>
            <div className="flex items-center gap-2.5">
              <Skeleton width={38} height={38} />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton width={shape.nameWidth} height={12} />
                <Skeleton width={shape.handleWidth} height={10} />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {shape.contentLineWidths.map((width, lineIndex) => (
                <Skeleton key={lineIndex} width={width} height={12} />
              ))}
            </div>
            <Skeleton width={90} height={22} className="mt-4" />
          </Card>
        );
      })}
    </div>
  );
}
