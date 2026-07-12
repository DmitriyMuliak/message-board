import 'server-only';
import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'VALIDATION'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'NOT_AUTHOR'
  | 'NOT_FOUND'
  | 'SIMULATED_FAILURE';

export function apiError(status: number, code: ApiErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}
