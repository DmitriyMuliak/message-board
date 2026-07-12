'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

import { makeQueryClient } from '@/shared/api/query-client';
import { ToasterProvider } from '@/shared/ui/Toaster';

const ReactQueryDevtools = dynamic(
  () =>
    import('@tanstack/react-query-devtools').then((mod) => ({ default: mod.ReactQueryDevtools })),
  { ssr: false },
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

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
