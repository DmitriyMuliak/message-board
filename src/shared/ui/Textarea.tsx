'use client';

import { useId } from 'react';
import type { Ref, TextareaHTMLAttributes } from 'react';

import { cn } from '@/shared/lib/cn';

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  /** Accessible name, rendered as a real `<label>` — see `hideLabel` for
   * contexts (composer, inline-edit) where the spec draws placeholder
   * text instead of a visible label. */
  label: string;
  /**
   * Visually hides the label (`sr-only` — still in the accessibility
   * tree) for contexts like the composer, where the spec shows
   * placeholder copy ("What's happening?") instead of a visible label.
   * Prefer a visible label wherever the design allows it; defaults to
   * `false`.
   */
  hideLabel?: boolean;
  errorClass?: string;
  error?: string;
  id?: string;
  containerClassName?: string;
  labelClassName?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  label,
  hideLabel = false,
  id,
  containerClassName,
  error,
  errorClass,
  labelClassName,
  className,
  ref,
  onInput,
  rows = 1,
  'aria-describedby': ariaDescribedBy,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = error ? `${textareaId}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-2', containerClassName)}>
      <label
        htmlFor={textareaId}
        className={cn(
          'font-mono text-xs font-bold tracking-wider text-ink uppercase',
          hideLabel && 'sr-only',
          labelClassName,
        )}
      >
        {label}
      </label>
      <textarea
        id={textareaId}
        rows={rows}
        ref={ref}
        onInput={onInput}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'w-full resize-none overflow-y-auto rounded-none bg-transparent font-sans text-[16px] break-words text-ink',
          '[field-sizing:content] min-h-[50px]',
          'placeholder:text-faint',
          'outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink',
          'disabled:cursor-not-allowed disabled:text-disabled-ink',
          className,
        )}
        {...props}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className={cn('font-sans text-sm font-bold text-red-500 sr-only', errorClass)}
        >
          {error}
        </p>
      )}
    </div>
  );
}
