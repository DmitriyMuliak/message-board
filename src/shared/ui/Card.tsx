import type { HTMLAttributes, Ref } from 'react';

import { cn } from '@/shared/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

export function Card({ className, ref, ...props }: CardProps) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-none border-[3px] border-ink bg-paper p-[14px] font-sans text-ink lg:p-[18px]',
        className,
      )}
      {...props}
    />
  );
}
