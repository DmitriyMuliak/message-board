import { ReactNode, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { createAppQueryClient } from '@/app/query-client';
import { ToasterProvider } from '@/shared/ui/Toaster';

export function TestRootProviders({ children }: { children: ReactNode }) {
  // A new client per render, for test isolation — and through the app's own factory,
  // so a test renders the configuration production runs, not a lookalike. That is not
  // theoretical: the app's one per-resource default is `placeholderData:
  // keepPreviousData`, and this renderer used to be missing it, which is exactly the
  // behaviour a "filter change swaps the list in place" test would assert.
  //
  // `retry: false` is the single deliberate difference: a mocked rejection should
  // surface on the first attempt instead of a test waiting out the retry backoff.
  const [queryClient] = useState(() =>
    createAppQueryClient({ defaultOptions: { queries: { retry: false } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToasterProvider>{children}</ToasterProvider>
    </QueryClientProvider>
  );
}
