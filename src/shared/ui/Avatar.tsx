import type { HTMLAttributes } from 'react';

import { cn } from '@/shared/lib/cn';

export type AvatarVariant = 'self' | 'other';

export interface AvatarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  name: string;
  initials?: string;
  variant?: AvatarVariant;
  size?: number;
}

function deriveInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

export function Avatar({
  name,
  initials,
  variant = 'other',
  size = 38,
  className,
  style,
  ...props
}: AvatarProps) {
  const content = initials ?? deriveInitial(name);

  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-none border-[2.5px] border-ink font-sans font-bold text-ink',
        variant === 'self' ? 'bg-accent' : 'bg-paper',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), ...style }}
      {...props}
    >
      <span aria-hidden="true">{content}</span>
    </div>
  );
}
