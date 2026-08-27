'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

import { ToasterProvider } from '@/shared/ui/Toaster';

import { createAppQueryClient } from './query-client';

const ReactQueryDevtools = dynamic(
  () =>
    import('@tanstack/react-query-devtools').then((mod) => ({ default: mod.ReactQueryDevtools })),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per mount, and `createAppQueryClient` rather than `makeQueryClient`
  // so this root and the RSC prefetch in `(main)/page.tsx` cannot drift apart.
  const [queryClient] = useState(() => createAppQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ToasterProvider>
        {children}
        {process.env.NODE_ENV === 'development' ? (
          <ReactQueryDevtools initialIsOpen={false} />
        ) : null}
      </ToasterProvider>
    </QueryClientProvider>
  );
}
