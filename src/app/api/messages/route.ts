import { NextResponse } from 'next/server';

import { apiError } from '@/server/http';
import { createMessage, listMessages, MessageValidationError } from '@/server/messages-service';
import { shouldSimulateFailure } from '@/server/simulate';
import { normalizeFilters } from '@/features/feed-filters/model/filters';
import { withApiRoute } from '@/shared/api/withApiRoute';

function parseLimit(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const GET = withApiRoute(async (request, ctx) => {
  const { searchParams } = request.nextUrl;
  const filters = normalizeFilters(searchParams);
  const cursor = searchParams.get('cursor');
  const limit = parseLimit(searchParams.get('limit'));

  const page = await listMessages(ctx.session.userId, filters, cursor, limit);
  return NextResponse.json(page);
});

export const POST = withApiRoute(async (request, ctx) => {
  const body: unknown = await request.json().catch(() => null);

  if (shouldSimulateFailure(body, 'content')) {
    return apiError(503, 'SIMULATED_FAILURE', 'Simulated failure — please retry.');
  }

  try {
    const message = await createMessage(ctx.session.userId, body);
    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    if (err instanceof MessageValidationError) {
      return apiError(400, 'VALIDATION', err.message);
    }
    throw err;
  }
});
