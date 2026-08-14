import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import { verifySession, type Session } from './auth-service';
import { apiError } from './http';

export interface RouteContext {
  params: Record<string, string | string[]>;
  session: Session;
}

/**
 * Higher-order function that wraps an API route handler with session verification
 * and error handling. Any other cross-cutting concern every route needs — request
 * logging, rate limiting — belongs here too.
 *
 * It lives in `server/`, not `shared/`: it depends on `auth-service` and speaks
 * `NextRequest`/`NextResponse`, so it is backend code by nature. In `shared/` it
 * made `shared` import upwards, which cost `shared` its one defining property —
 * that it is a leaf with no dependencies on the rest of the app.
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
