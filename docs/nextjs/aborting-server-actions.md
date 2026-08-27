# Cancelling a Server Action from the client

You **cannot** stop a Server Action once it is running on the server — an `AbortSignal` does not
serialize across the Next boundary, so there is no way to thread cancellation down to the database.
See [TanStack Query and Server Actions](../tanstack-query/server-actions.md) for why.

What you _can_ do is stop **waiting** for the result: reject the promise locally, ignore the response
when it eventually lands, and leave the UI alone. That is usually what "cancel" means in the UI
anyway — the user navigated away, or pressed Cancel, and no longer cares.

This page is the pattern for doing that cleanly.

## The core: race the call against the signal

```ts
const raceWithAbort = async <T>(actionCall: () => Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  const abortPromise = new Promise<never>((_, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });

  return Promise.race([actionCall(), abortPromise]);
};
```

An `AbortError` is thrown locally the moment the signal fires. The server keeps working; nobody is
listening.

## Two wrappers

### Variant 1 — accept an external `{ signal }`

For when the caller already owns a controller, e.g. one supplied by TanStack Query.

```ts
type ActionOptions = { signal?: AbortSignal };

const hasSignal = (value: unknown): value is ActionOptions & { signal: AbortSignal } =>
  typeof value === 'object' &&
  value !== null &&
  'signal' in value &&
  value.signal instanceof AbortSignal;

export const createAsyncServerAction = <TArgs extends unknown[], TResponse>(
  action: (...args: [...TArgs, ActionOptions?]) => Promise<TResponse>,
) => {
  return (...args: [...TArgs, ActionOptions?]) => {
    const maybeOptions = args.at(-1);
    const signal = hasSignal(maybeOptions) ? maybeOptions.signal : undefined;

    const run = async (): Promise<ServerActionResult<TResponse>> => {
      try {
        const data = signal
          ? await raceWithAbort(() => action(...(args as Parameters<typeof action>)), signal)
          : await action(...(args as Parameters<typeof action>));

        return { success: true, data };
      } catch (error) {
        if (isAbortError(error)) throw error; // let cancellation through untouched
        return handleServerError(error);
      }
    };

    return { run };
  };
};
```

### Variant 2 — own the controller, return `abort()`

```ts
export const createAbortableServerAction = <TArgs extends unknown[], TResponse>(
  action: (...args: [...TArgs, ActionOptions]) => Promise<TResponse>,
) => {
  return (...args: TArgs) => {
    const controller = new AbortController();

    const run = async (): Promise<ServerActionResult<TResponse>> => {
      try {
        const data = await raceWithAbort(
          () => action(...args, { signal: controller.signal }),
          controller.signal,
        );
        return { success: true, data };
      } catch (error) {
        if (isAbortError(error)) throw error;
        return handleServerError(error);
      }
    };

    return { run, abort: () => controller.abort() };
  };
};
```

Note that `run`/`abort` are created **on the client**. A Server Action must return serializable data,
so it can never hand back an object containing functions.

## Wiring it up across three files

The arrangement that works, and the two rules that make it work.

**`serverAction.ts`** — has the directive:

```ts
'use server';
import { apiCvAnalyser } from '@/api/server';
import { ApiRoutes } from '@/api/server/apiRoutes';

export async function analyzeResume(payload: AnalyzePayload) {
  return apiCvAnalyser.post(ApiRoutes.CV_ANALYSER.analyze, { payload });
}
```

**`client/utils/callServerActionWithAbort.ts`** — no directive:

```ts
import { isAbortError } from '@/api/apiService/utils';

export function callServerActionWithAbort<T>(
  actionCall: () => Promise<T>,
  controller?: AbortController,
) {
  const signal = controller?.signal;

  const run = async (): Promise<T> => {
    if (!signal) return actionCall();
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    let onAbort: (() => void) | undefined;
    const abortPromise = new Promise<never>((_, reject) => {
      onAbort = () => {
        signal.removeEventListener('abort', onAbort!);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });

    try {
      return await Promise.race([actionCall(), abortPromise]);
    } finally {
      if (onAbort) signal.removeEventListener('abort', onAbort);
    }
  };

  return { run, abort: () => controller?.abort() };
}
```

**`clientAction.ts`** — no directive:

```ts
import { analyzeResume } from '@/actions/resume/resumeActions';
import { callServerActionWithAbort } from '@/client/utils/callServerActionWithAbort';

export const act = (payload: AnalyzePayload, controller?: AbortController) =>
  callServerActionWithAbort(() => analyzeResume(payload), controller);
```

**The component:**

```tsx
const controller = useMemo(() => new AbortController(), []);
const { run, abort } = act(params, controller);

useEffect(() => {
  run().catch((e) => {
    if (isAbortError(e)) return; // silently ignore cancellation
    // handle everything else
  });
  return () => abort(); // cancel on unmount or when switching away
}, [run, abort]);
```

## The two rules

1. **Call the action inside a lambda**, never at module scope — otherwise it fires on import rather
   than when you invoke `run()`. A client file importing a Server Action is fine; Next generates a
   proxy, and the request only goes out when the proxy is called.
2. **Build `run`/`abort` on the client.** The Server Action itself can only return serializable data,
   so functions cannot come back from it.

## What this does and does not buy you

|                                            |                            |
| ------------------------------------------ | -------------------------- |
| UI stops waiting, no stale state update    | ✅                         |
| A cancelled result is never applied        | ✅                         |
| The HTTP request is dropped by the browser | ✅                         |
| Server-side work actually stops            | ❌ — it runs to completion |
| Long-running SQL is cancelled              | ❌                         |

If you need the server work to genuinely stop, that is an argument for a route handler, where
`request.signal` reaches all the way down.
