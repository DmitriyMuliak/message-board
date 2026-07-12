'use client';

import type { ButtonHTMLAttributes, Ref } from 'react';

import { cn } from '@/shared/lib/cn';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  isButton?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Chip({ active = false, className, ref, isButton = true, ...props }: ChipProps) {
  const baseClasses = cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-none',
    'border-2 border-ink px-[9px] py-[5px] font-mono text-[11px] text-ink md:px-2.5 md:text-xs',
    'cursor-pointer',
    'outline-hidden focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink',
    active ? 'bg-accent font-bold' : 'bg-paper font-normal',
    className,
  );

  return isButton ? (
    <button ref={ref} type="button" aria-pressed={active} className={baseClasses} {...props} />
  ) : (
    <span ref={ref} className={baseClasses} {...props} />
  );
}
