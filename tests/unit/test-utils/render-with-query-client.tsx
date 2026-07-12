import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';

/**
 * Wraps `render` with a fresh `QueryClient` per call — never a shared/
 * module-level client, matching the app's own "a module-level client
 * would leak cache across users/requests" rule (`shared/api/query-
 * client.ts`) applied to test isolation instead of users. `retry: false`
 * so a mocked rejection surfaces on the first attempt instead of a test
 * waiting through TanStack's default retry backoff.
 *
 * For any component that calls `useQuery`/`useMutation` (e.g.
 * `UserSelect`, and anything composing it like `FilterBar`/`FilterSheet`).
 */
export function renderWithQueryClient(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>, options);
}
