'use client';

import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';

interface LoadMoreButtonProps {
  onClick: () => void;
  isLoading: boolean;
  hasMore: boolean;
  className?: string;
}

export function LoadMoreButton({ onClick, isLoading, hasMore, className }: LoadMoreButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      shadow={4}
      disabled={!hasMore}
      loading={isLoading}
      onClick={onClick}
      className={cn('self-center', className)}
    >
      {!hasMore ? 'NO MORE MESSAGES' : isLoading ? 'LOADING…' : 'LOAD MORE ↓'}
    </Button>
  );
}
