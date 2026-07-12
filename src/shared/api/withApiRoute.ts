import { NextRequest, NextResponse } from 'next/server';

import { verifySession, type Session } from '@/server/auth-service';
import { apiError } from '@/server/http';

export interface RouteContext {
  params: Record<string, string | string[]>;
  session: Session;
}

/**
 * High-order function that wraps an API route handler with session verification and error * handling. * We can put here any other common logic that all API routes should have, like * logging.
 */
export function withApiRoute(
  handler: (req: NextRequest, ctx: RouteContext) => Promise<NextResponse | Response>,
) {
  return async (
    req: NextRequest,
    context: {
      params?: Promise<Record<string, string | string[]>>;
    },
  ) => {
    try {
      const session = await verifySession(req.cookies);
      if (!session) {
        return apiError(401, 'UNAUTHORIZED', 'You must be logged in to perform this action.');
      }

      let resolvedParams: Record<string, string | string[]> = {};
      if (context?.params) {
        resolvedParams = await context.params;
      }

      return await handler(req, {
        params: resolvedParams,
        session,
      });
    } catch (error) {
      console.error('Unhandled API Route Error:', error);

      return NextResponse.json(
        { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error.' } },
        { status: 500 },
      );
    }
  };
}
