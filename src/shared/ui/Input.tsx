'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, Ref } from 'react';

import { cn } from '@/shared/lib/cn';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  id?: string;
  error?: string;
  containerClassName?: string;
  labelClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  label,
  id,
  error,
  containerClassName,
  labelClassName,
  className,
  ref,
  'aria-describedby': ariaDescribedBy,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-2 relative', containerClassName)}>
      <label
        htmlFor={inputId}
        className={cn(
          // 0.08em, not `tracking-wider` (0.05em = 0.6px): the spec's field labels measure
          // 0.96px at 12px and 0.88px at 11px — both are 0.08em.
          'font-mono text-[11px] font-bold tracking-[0.08em] text-ink uppercase md:text-xs',
          labelClassName,
        )}
      >
        {label}
      </label>
      <input
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-[52px] w-full rounded-none bg-paper px-4 font-sans text-base text-ink border-[2.5px]',
          error ? 'border-red-500' : 'border-ink',
          'placeholder:text-faint',
          'outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2',
          error ? 'focus-visible:outline-red-500' : 'focus-visible:outline-ink',
          'disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled-ink',
          className,
        )}
        {...props}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className="absolute top-full left-0 font-sans text-sm font-bold text-red-500"
        >
          {error}
        </p>
      )}
    </div>
  );
}
