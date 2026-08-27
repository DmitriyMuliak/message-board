'use client';

import type { ButtonHTMLAttributes, Ref } from 'react';

import { cn } from '@/shared/lib/cn';

export type BrutalShadow = 2 | 3 | 4 | 5 | 6;
/**
 * @public — same reasoning as `AvatarVariant`. (`BrutalShadow` above carries no
 * tag only because knip already sees it used in a value position; it is no less
 * public than this one.)
 */
export type ButtonVariant = 'accent' | 'ghost' | 'link';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  shadow?: BrutalShadow | 'none';
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  accent: 'bg-accent text-ink',
  ghost: 'bg-paper text-ink',
  link: 'text-muted underline bg-transparent',
};

const SHADOW_CLASSES: Record<BrutalShadow, string> = {
  2: 'shadow-brutal-2',
  3: 'shadow-brutal-3',
  4: 'shadow-brutal-4',
  5: 'shadow-brutal-5',
  6: 'shadow-brutal-6',
};

function shadowClassName(shadow: BrutalShadow | 'none'): string {
  return shadow === 'none' ? '' : SHADOW_CLASSES[shadow];
}

export function Button({
  variant = 'accent',
  shadow,
  type = 'button',
  disabled,
  loading,
  onClick,
  className,
  ref,
  ...props
}: ButtonProps) {
  const visuallyDisabled = Boolean(disabled) || Boolean(loading);
  const isLink = variant === 'link';
  const resolvedShadow: BrutalShadow | 'none' =
    visuallyDisabled || isLink ? 'none' : (shadow ?? (variant === 'accent' ? 4 : 'none'));

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap outline-hidden',
        'focus-visible:outline-solid focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink cursor-pointer',

        !isLink && 'rounded-none border-[3px] border-ink px-5 py-2.5 font-mono text-sm font-bold',

        isLink && 'font-sans text-xs',

        visuallyDisabled && 'cursor-not-allowed',

        visuallyDisabled
          ? isLink
            ? 'text-disabled-ink no-underline'
            : 'bg-disabled text-disabled-ink'
          : VARIANT_CLASSES[variant],

        shadowClassName(resolvedShadow),
        className,
      )}
      {...props}
    />
  );
}
