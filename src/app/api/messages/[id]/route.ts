import { NextResponse } from 'next/server';

import { apiError } from '@/server/http';
import {
  deleteMessage,
  MessageForbiddenError,
  MessageNotFoundError,
  MessageValidationError,
  updateMessage,
} from '@/server/messages-service';
import { shouldSimulateFailure } from '@/server/simulate';
import { withApiRoute } from '@/shared/api/withApiRoute';

export const PATCH = withApiRoute(async (request, ctx) => {
  const id = ctx.params.id as string;
  const userId = ctx.session.userId;

  const body: unknown = await request.json().catch(() => null);
  if (shouldSimulateFailure(body, 'content')) {
    return apiError(503, 'SIMULATED_FAILURE', 'Simulated failure — please retry.');
  }

  try {
    const message = await updateMessage(userId, id, body);
    return NextResponse.json(message);
  } catch (err) {
    if (err instanceof MessageNotFoundError) {
      return apiError(404, 'NOT_FOUND', err.message);
    }
    if (err instanceof MessageForbiddenError) {
      return apiError(403, 'NOT_AUTHOR', err.message);
    }
    if (err instanceof MessageValidationError) {
      return apiError(400, 'VALIDATION', err.message);
    }
    throw err;
  }
});

export const DELETE = withApiRoute(async (_request, ctx) => {
  const id = ctx.params.id as string;
  const userId = ctx.session.userId;

  // DELETE has no body, so only the random `MOCK_FAILURE_RATE` path (never
  // the deterministic `#fail` trigger, which needs message content) applies.
  if (shouldSimulateFailure(null, 'content')) {
    return apiError(503, 'SIMULATED_FAILURE', 'Simulated failure — please retry.');
  }

  try {
    await deleteMessage(userId, id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof MessageNotFoundError) {
      return apiError(404, 'NOT_FOUND', err.message);
    }
    if (err instanceof MessageForbiddenError) {
      return apiError(403, 'NOT_AUTHOR', err.message);
    }
    throw err;
  }
});
