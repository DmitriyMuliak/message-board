import type { HTMLAttributes } from 'react';

import { cn } from '@/shared/lib/cn';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
}

export function Skeleton({ width, height, className, style, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-none bg-skeleton motion-safe:animate-pulse', className)}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}
