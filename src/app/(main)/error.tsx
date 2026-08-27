'use client';

import { useEffect } from 'react';

import { FeedError } from '@/views/feed';

/**
 * Designed error boundary for `/` ("Feed initial load fails → Error
 * panel in feed (invented, empty-state idiom); RETRY → refetch()" — here
 * the RETRY affordance is `reset()`, Next's own recovery mechanism for an
 * `error.tsx` boundary, which re-renders the segment from scratch). Must be
 * a Client Component — Next.js error boundaries only work as Client
 * Components regardless of how the segment they guard is rendered.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 py-8 lg:px-8">
      <FeedError onRetry={reset} message={error.message} />
    </div>
  );
}
