import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SessionProvider } from '@/entities/session';
import { ApiError, apiService } from '@/shared/api/http-client';
import { customRender } from '@tests/unit/test-utils/customRender';
import { FeedView } from './FeedView';

/**
 * Mocked at the HTTP client, not at the network: what's under test is where a
 * failed feed query *lands* in the React tree, not how it was transported.
 * `useMessagesInfinite`, `useSuspenseInfiniteQuery` and the boundary around
 * them all stay real — that's the part that was broken.
 */
vi.mock('@/shared/api/http-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/http-client')>();
  return { ...actual, apiService: vi.fn() };
});

// The sidebar's user list is a server action; irrelevant here and unreachable
// outside a request scope.
vi.mock('@/features/feed-filters/api/users.action', () => ({
  getUsersAction: vi.fn(async () => ({ users: [] })),
}));

/**
 * `FeedView` pulls in the whole composed tree — filter bar, composer,
 * virtualized list, plus the `next/dynamic` date picker and `react-day-picker`
 * behind it. On a cold module graph that transform cost alone exceeds the 5s
 * default before the first assertion even runs.
 */
vi.setConfig({ testTimeout: 20_000 });

const CURRENT_USER = { id: 'u_ada', name: 'Ada Lovelace', handle: 'ada_l' };

const A_MESSAGE = {
  id: '11111111-1111-4111-8111-111111111111',
  content: 'Shipped the keyset cursor.',
  tag: 'PRODUCT',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: null,
  author: CURRENT_USER,
  permissions: { canEdit: true, canDelete: true },
};

const A_PAGE = { items: [A_MESSAGE], nextCursor: null, hasMore: false };

function renderFeed() {
  return customRender(
    <SessionProvider currentUser={CURRENT_USER}>
      <FeedView />
    </SessionProvider>,
  );
}

describe('FeedView — failed feed load', () => {
  beforeEach(() => {
    vi.mocked(apiService).mockReset();
  });

  it('renders the feed error panel in place, keeping the composer usable', async () => {
    vi.mocked(apiService).mockRejectedValue(
      new ApiError(503, 'SIMULATED_FAILURE', 'Simulated failure — please retry.'),
    );

    renderFeed();

    // A suspense query throws instead of setting `isError`. Before there was a
    // boundary here, this threw past the whole view into the route-level
    // `error.tsx` and the panel below never rendered.
    const panel = await screen.findByRole('alert');
    expect(panel).toHaveTextContent(/couldn.t load messages/i);
    expect(panel).toHaveTextContent('Simulated failure — please retry.');

    // The point of catching it *here*: the rest of the page survives.
    expect(screen.getByRole('button', { name: 'POST' })).toBeInTheDocument();
  });

  it('refetches in place when RETRY is pressed', async () => {
    const user = userEvent.setup();
    vi.mocked(apiService)
      .mockRejectedValueOnce(new ApiError(503, 'SIMULATED_FAILURE', 'Server is busy.'))
      .mockResolvedValue(A_PAGE);

    renderFeed();
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: 'RETRY' }));

    expect(await screen.findByText(A_MESSAGE.content)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
