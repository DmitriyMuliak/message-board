import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToasterProvider } from '@/shared/ui/Toaster';

/**
 * App-wide providers, and nothing feature-specific.
 *
 * A fresh QueryClient per render keeps tests isolated, and `retry: false` stops
 * a deliberately failing query from burning the test's timeout on retries.
 */
export function TestRootProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToasterProvider>{children}</ToasterProvider>
    </QueryClientProvider>
  );
}
