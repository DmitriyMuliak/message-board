# The BFF proxy route — one catch-all, not one route per endpoint

The situation: the browser needs to call an internal API, but the tokens must never leave the server.
Next stays the backend-for-frontend and keeps the credentials; the browser talks to a **same-origin
route handler** that authenticates and forwards.

The important part is that this is **one file**, not a route per endpoint.

```
Browser ──GET /next-api/be/api/jobs/{id}/progress──▶  Route Handler (one file)
                                                       ├─ ensureFreshAccessToken()
                                                       ├─ header allow-list
                                                       └─ fetch(API_BASE_URL/…)
        ◀────────────── JSON + real Cache-Control ─────┘
```

## Which of the three tools

Next gives you three ways to put something in front of a request. The
[Backend for Frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend) lists all three
under "Proxying to a backend":

| Tool                                             | Use it when                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Route Handler** (`app/api/[...slug]/route.ts`) | You need to _do_ something — attach a token, check a session, reshape the response, set cache headers |
| **`proxy.ts`**                                   | You need a check before a request reaches any route, across many paths                                |
| **`rewrites`** in `next.config.js`               | Pure forwarding, no logic — the cheapest option                                                       |

For "check auth and attach a server-side token", the answer is the **route handler**. A rewrite cannot
add a secret; `proxy` can, but Vercel explicitly discourages putting logic there — more on that below.

## The official example

Straight from the guide:

```ts
// app/api/[...slug]/route.ts
import { isValidRequest } from '@/lib/utils';

export async function POST(request: Request, { params }) {
  const clonedRequest = request.clone();
  const isValid = await isValidRequest(clonedRequest);

  if (!isValid) {
    return new Response(null, { status: 400, statusText: 'Bad Request' });
  }

  const { slug } = await params;
  const pathname = slug.join('/');
  const proxyURL = new URL(pathname, 'https://nextjs.org');
  const proxyRequest = new Request(proxyURL, request);

  try {
    return fetch(proxyRequest);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Unexpected exception';
    return new Response(message, { status: 500 });
  }
}
```

Two details in there that are easy to skim past:

- **`request.clone()`** — a body can only be read once. If validation reads it, the forwarded request
  needs the clone. The guide makes this its own point: _"You can only read the request body once."_
- **`new Request(proxyURL, request)`** — this is the shortcut that makes the whole thing ~50 lines. It
  reuses the method, headers and body of the incoming request.

## ⚠️ The header trap

`new Request(proxyURL, request)` copies **every** header, including `cookie` and `authorization`.

For a public upstream like `nextjs.org` that is harmless. For your own API it means the browser's
session cookie is forwarded to a service that has no business seeing it — and if the upstream is a
third party, you have just leaked it off your infrastructure.

The docs are direct about this:

> In general, avoid copying all incoming request headers because doing so can leak sensitive data to
> clients or upstream services.
>
> Prefer a defensive approach by creating a subset of incoming request headers using an allow-list.

The reference implementation they give discards custom `x-*` headers plus `authorization` and
`cookie`:

```ts
const incoming = new Headers(request.headers);
const forwarded = new Headers();

for (const [name, value] of incoming) {
  const headerName = name.toLowerCase();
  // Keep only known-safe headers, discard custom x-* and other sensitive ones
  if (!headerName.startsWith('x-') && headerName !== 'authorization' && headerName !== 'cookie') {
    forwarded.set(name, value); // preserve original header name casing
  }
}
```

> That snippet lives in the [`NextResponse.next()` reference](https://nextjs.org/docs/app/api-reference/functions/next-response#next)
> and is written for `proxy.ts`, where the result goes into
> `NextResponse.next({ request: { headers } })`. The **filtering logic** is what transfers; in a route
> handler you feed `forwarded` into your own `fetch` instead.

## Putting it together for a private upstream

```ts
// app/next-api/be/[...path]/route.ts
import { ensureFreshAccessToken } from '@/lib/auth';

const API_BASE_URL = process.env.API_BASE_URL!;

// Everything the upstream legitimately needs. Note what is absent:
// cookie, authorization (we set our own), host, and every x-*.
const FORWARD_HEADERS = ['accept', 'accept-language', 'content-type', 'content-length'];

async function handler(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const token = await ensureFreshAccessToken();
  if (!token) {
    return new Response(null, { status: 401 });
  }

  const { path } = await ctx.params;
  const incomingUrl = new URL(request.url);
  const upstream = new URL(path.join('/'), API_BASE_URL);
  upstream.search = incomingUrl.search; // query strings are not in `path`

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('authorization', `Bearer ${token}`);

  try {
    const response = await fetch(upstream, {
      method: request.method,
      headers,
      // GET/HEAD carry no body; `duplex` is required for a streamed body
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      // @ts-expect-error — not yet in the DOM lib types
      duplex: 'half',
      cache: 'no-store',
      signal: request.signal, // a client disconnect cancels the upstream call
    });

    return response;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Unexpected exception';
    return new Response(message, { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
```

Roughly fifty lines, every method, every endpoint. The generated `paths` type from an OpenAPI schema
serves both the server client and the browser client, because the path segments are unchanged.

Three things worth noticing:

- **An allow-list, not a deny-list.** A deny-list has to be updated every time the upstream or the
  browser starts sending something new; an allow-list fails closed.
- **`signal: request.signal`** — this is the argument for a route handler over a Server Action. The
  signal reaches all the way to the upstream, so a navigation away actually cancels the call. A Server
  Action cannot do that; see [cancelling a Server Action](./aborting-server-actions.md).
- **Returning the upstream `Response` directly** preserves its status and its real `Cache-Control`,
  which is the point of proxying rather than re-wrapping in `Response.json()`.

## Where the auth check belongs

The route handler is the right place. `proxy.ts` looks tempting for a blanket check, and Vercel warns
against leaning on it:

> Always verify credentials before granting access. **Do not rely on proxy alone for authentication
> and authorization.**

There is a concrete reason, not just caution. From the `proxy` reference:

> Server Functions are not separate routes in this chain. They are handled as POST requests to the
> route where they are used, so a Proxy matcher that excludes a path will also skip Server Function
> calls on that path.
>
> A matcher change or a refactor that moves a Server Function to a different route can **silently
> remove Proxy coverage**.

So a `matcher` edit made for an unrelated reason can quietly unprotect a mutation. Treat `proxy` as an
optimisation — an early redirect, a cheap rejection — and keep the authoritative check next to the
thing being protected.

Vercel's own position on the whole feature, from the migration notes:

> We recommend users avoid relying on Middleware unless no other options exist.

That is also why the file was renamed: `middleware` → `proxy` in **v16.0.0**, because "middleware"
invited Express-style thinking. Codemod: `npx @next/codemod@canary middleware-to-proxy .` Proxy now
defaults to the **Node.js runtime**, and the `runtime` config option throws if you set it.

## If you need no logic at all — use a rewrite

Pure forwarding needs no route handler:

```js
// next.config.js
module.exports = {
  async rewrites() {
    return [{ source: '/ps/:path*', destination: 'https://payments.internal/:path*' }];
  },
};
```

No code, no cold start, no header handling to get wrong. The moment you need a token attached or a
session checked, it stops being enough — that is the line between the two.

## Caveats worth knowing before you ship it

- **`OPTIONS` is generated for you.** If you do not define it, Next adds it and sets `Allow` from the
  methods you did define. Fine for same-origin; for CORS see the
  [route handler CORS section](https://nextjs.org/docs/app/api-reference/file-conventions/route#cors).
- **Route handlers are often lambdas.** They cannot share state between requests, may not be able to
  write to the filesystem, can be killed on timeout, and WebSockets will not work.
- **Do not fetch this from a Server Component.** The guide is explicit: fetch from the source, not via
  your own route handler — it is an extra HTTP round trip at runtime, and at build time there is no
  server listening, so a prerender fails.
- **`_next/data` runs `proxy` even when your matcher excludes it.** Deliberate, so that protecting a
  page does not accidentally leave its data route open.

## Decision table

| You need                                                        | Use                                                                                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Forward, nothing else                                           | `rewrites`                                                                                     |
| Attach a server-side token, check a session, reshape a response | catch-all Route Handler                                                                        |
| One cheap check across many paths, before routing               | `proxy.ts` — plus the real check downstream                                                    |
| Cancel the upstream call when the client goes away              | Route Handler (`request.signal`)                                                               |
| Mutate data from a form                                         | Server Action, not a proxy — see [caching and server actions](./caching-and-server-actions.md) |

---

**Sources** — all Next.js 16.3.x docs:

- [Backend for Frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend) — the
  catch-all proxy example, security section, caveats
- [`NextResponse` reference](https://nextjs.org/docs/app/api-reference/functions/next-response#next) —
  the header allow-list
- [`proxy.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — matcher,
  Server Function coverage gap, the migration rationale
- [`rewrites` config](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
