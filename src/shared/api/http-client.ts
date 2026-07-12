type ApiFetchInit = Omit<RequestInit, 'body'> & {
  body?: unknown;
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
};

export async function apiService<T = unknown>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { body, headers, ...rest } = init;
  const hasBody = body !== undefined;

  const response = await fetch(path, {
    ...rest,
    credentials: 'same-origin',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  // `204 No Content` — no body.
  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const envelope = isErrorEnvelope(payload) ? payload.error : undefined;
    const code = typeof envelope?.code === 'string' ? envelope.code : 'UNKNOWN';
    const message =
      typeof envelope?.message === 'string'
        ? envelope.message
        : response.statusText || 'Request failed.';
    throw new ApiError(response.status, code, message);
  }

  return payload as T;
}

interface ErrorEnvelope {
  error?: { code?: unknown; message?: unknown };
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
