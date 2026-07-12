import { formatAbsoluteDateTime, formatRelativeTime } from '@/shared/lib/datetime';
import { cn } from '@/shared/lib/cn';

export interface RelativeTimeProps {
  /** UTC ISO-8601 timestamp */
  createdAt: string;
  className?: string;
}

export function RelativeTime({ createdAt, className }: RelativeTimeProps) {
  return (
    <time
      dateTime={createdAt}
      title={formatAbsoluteDateTime(createdAt)}
      className={cn('font-mono text-xs text-muted', className)}
      suppressHydrationWarning
    >
      {formatRelativeTime(createdAt)}
    </time>
  );
}
