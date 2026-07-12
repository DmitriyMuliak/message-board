import { ReactNode, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { makeQueryClient } from '@/shared/api/query-client';
import { ToasterProvider } from '@/shared/ui/Toaster';

export function TestRootProviders({ children }: { children: ReactNode }) {
  // Create a new QueryClient for each test render to ensure test isolation.
  // We disable retries for queries in tests so failing queries don't cause timeouts.
  const [queryClient] = useState(() =>
    makeQueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToasterProvider>{children}</ToasterProvider>
    </QueryClientProvider>
  );
}
