# Streaming UI on the frontend — a survey

Nine ways to stream data into a React UI, what each is actually for, and a decision tree at the end.
Written with LLM token streaming as the motivating case, but most of it applies to any progressive
response.

## Contents

1. [Vercel AI SDK](#1-vercel-ai-sdk)
2. [Server-Sent Events](#2-server-sent-events-sse)
3. [WebSockets](#3-websockets)
4. [React Server Components + Suspense](#4-react-server-components--suspense)
5. [LangChain.js streaming](#5-langchainjs-streaming)
6. [tRPC subscriptions](#6-trpc-subscriptions)
7. [React 19 `useOptimistic`](#7-react-19-useoptimistic)
8. [ReadableStream API](#8-readablestream-api)
9. [TanStack Query `streamedQuery`](#9-tanstack-query-streamedquery)
10. [Skeleton vs streaming as UX](#10-skeleton-vs-streaming-as-ux)
11. [Decision tree](#decision-tree)
12. [Practices](#practices)

---

## 1. Vercel AI SDK

**What it is:** the de-facto standard for streaming LLM responses in React/Next.js. Gives you
`useChat` and `useCompletion`, with SSE underneath.

**Who uses it:** Vercel, OpenAI and Anthropic partners, Linear, most YC AI startups.

```tsx
// Frontend
import { useChat } from '@ai-sdk/react';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({ api: '/api/chat' });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

```ts
// Backend — Next.js App Router
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = await streamText({ model: anthropic('claude-sonnet-4-6'), messages });
  return result.toDataStreamResponse();
}
```

**For:** abstracts away the whole streaming boilerplate; multi-provider; error handling and
reconnection built in; production patterns for persistence and optimistic updates.

**Against:** lock-in to the SDK's patterns; less control over the protocol; one more dependency to
keep current.

**Use it when:** you are building an LLM chat on React or Next.js. This is the default.

---

## 2. Server-Sent Events (SSE)

**What it is:** a browser standard for one-way server → client streaming. OpenAI, Anthropic and every
major LLM API stream tokens over SSE.

### With `EventSource`

```ts
function streamLLMResponse(prompt: string, onChunk: (text: string) => void) {
  const eventSource = new EventSource(`/api/stream?prompt=${encodeURIComponent(prompt)}`);

  eventSource.onmessage = (event) => {
    if (event.data === '[DONE]') {
      eventSource.close();
      return;
    }
    onChunk(JSON.parse(event.data).text);
  };

  eventSource.onerror = () => eventSource.close();
}
```

### With fetch + ReadableStream

`EventSource` is GET-only. Fetch lets you POST a body:

```ts
async function streamWithFetch(prompt: string, onChunk: (text: string) => void) {
  const response = await fetch('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value));
  }
}
```

```ts
// Backend — Express
app.post('/api/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: req.body.prompt }],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta') {
      res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
    }
  }
  res.write('data: [DONE]\n\n');
  res.end();
});
```

**For:** native browser support; automatic reconnection (GET only); simpler than WebSockets for
one-way data; passes through most proxies and firewalls; plain HTTP, so HTTP/2 multiplexing applies.

**Against:** server → client only; `EventSource` cannot POST (fetch + SSE solves that but loses
auto-reconnect); ~6 connections per domain on HTTP/1.1; text only.

**Use it when:** LLM token streaming, or any event feed the client only reads. The default for
streaming that is not chat-SDK-shaped.

---

## 3. WebSockets

**What it is:** a bidirectional protocol. You need it when the client must send data _during_ the
stream — a stop signal, an interruption, a live update.

**Who uses it:** Linear (sync engine), Figma, Google Docs, game platforms.

```ts
function initWebSocketChat() {
  const ws = new WebSocket('wss://api.example.com/chat');

  ws.onopen = () => ws.send(JSON.stringify({ type: 'start', prompt: 'Hello' }));

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'token') appendToUI(msg.text);
    if (msg.type === 'complete') finishUI();
  };

  // the client can interrupt generation at any point
  document.querySelector('#stop')?.addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'stop' }));
  });

  return ws;
}
```

```ts
// Backend — ws
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const { type, prompt } = JSON.parse(data.toString());
    if (type !== 'start') return;

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const chunk of stream) {
      if (ws.readyState !== WebSocket.OPEN) break;
      if (chunk.type === 'content_block_delta') {
        ws.send(JSON.stringify({ type: 'token', text: chunk.delta.text }));
      }
    }
    ws.send(JSON.stringify({ type: 'complete' }));
  });
});
```

**For:** genuine two-way communication; no per-domain connection limit; lower latency for interactive
cases; binary support.

**Against:** you implement reconnection and heartbeat yourself; more overhead than SSE; needs its own
infrastructure; stateful connections make horizontal scaling harder; harder to debug.

**Use it when:** and only when you need bidirectional traffic mid-stream — a stop button on an LLM,
real-time collaboration, games.

---

## 4. React Server Components + Suspense

**What it is:** the Next.js 13+ approach. The server renders parts of the UI progressively; Suspense
boundaries let each part stream independently.

```tsx
import { Suspense } from 'react';

async function SlowComponent() {
  const data = await fetchSlowData(); // 2–3 seconds
  return <div>{data}</div>;
}

export default function Page() {
  return (
    <main>
      <Suspense fallback={<p>Loading header…</p>}>
        <FastComponent />
      </Suspense>

      {/* streams in as soon as it is ready */}
      <Suspense fallback={<Skeleton />}>
        <SlowComponent />
      </Suspense>
    </main>
  );
}
```

**For:** rendered on the server, so no JS cost on the client; fine-grained streaming through
boundaries; smaller bundles (Vercel reports up to 62%); the page feels fast; better SEO.

**Against:** hard to debug; no hooks in async server components; needs the App Router; steep learning
curve; **not** suited to real-time token streaming — a server component resolves once.

**Use it when:** a page has several blocks of data with different latencies. Not for chat.

> The awaited-versus-streamed version of this decision, as made in this repo, is in
> [`architecture/rendering.md`](../architecture/rendering.md).

---

## 5. LangChain.js streaming

**What it is:** a library for complex AI workflows — chains, agents, RAG.

```ts
const model = new ChatAnthropic({ model: 'claude-sonnet-4-6' });
const chain = RunnableSequence.from([model, new StringOutputParser()]);

app.post('/api/chain-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const stream = await chain.stream(req.body.input);
  for await (const chunk of stream) {
    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
  }
  res.end();
});
```

```ts
function useChainStream(input: string) {
  const [output, setOutput] = useState('');

  useEffect(() => {
    if (!input) return;
    setOutput('');

    const eventSource = new EventSource(`/api/chain-stream?input=${encodeURIComponent(input)}`);
    eventSource.onmessage = (e) => setOutput((prev) => prev + JSON.parse(e.data).text);
    eventSource.onerror = () => eventSource.close();

    return () => eventSource.close();
  }, [input]);

  return output;
}
```

**For:** composing multi-step chains and agents; streaming is well documented; tool calling built in;
easy to swap providers.

**Against:** heavier than direct API calls; unnecessary complexity for simple cases; large dependency
with frequent breaking changes.

**Use it when:** multi-step AI workflows, RAG pipelines, agent systems.

---

## 6. tRPC subscriptions

**What it is:** type-safe streaming with full TypeScript inference. Strong option for a full-stack
TypeScript monorepo.

```ts
export const appRouter = router({
  chat: publicProcedure.input(z.object({ prompt: z.string() })).subscription(({ input }) =>
    observable<string>((emit) => {
      (async () => {
        const stream = await anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{ role: 'user', content: input.prompt }],
        });

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta') emit.next(chunk.delta.text);
        }
        emit.complete();
      })();
    }),
  ),
});
```

```tsx
function ChatComponent({ prompt }: { prompt: string }) {
  const [output, setOutput] = useState('');

  trpc.chat.useSubscription(
    { prompt },
    { onData: (chunk) => setOutput((prev) => prev + chunk), onError: console.error },
  );

  return <div>{output}</div>;
}
```

**For:** end-to-end type safety with no separate schema; error handling included; simpler than raw
WebSocket/SSE; supports both transports.

**Against:** frontend and backend must share a repo; awkward for distributed systems; smaller
adoption than REST or GraphQL.

**Use it when:** full-stack TypeScript monorepo where type safety is the priority.

---

## 7. React 19 `useOptimistic`

**What it is:** a hook for instant UI feedback while an async operation completes, with automatic
rollback on failure. It is not a streaming transport — it complements one.

```tsx
function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state: Message[], newMsg: Message) => [...state, newMsg],
  );
  const [, startTransition] = useTransition();

  async function sendMessage(formData: FormData) {
    const text = formData.get('message') as string;

    startTransition(() => {
      addOptimisticMessage({ id: crypto.randomUUID(), role: 'user', text });
    });

    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let assistantText = '';
    const assistantId = crypto.randomUUID();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assistantText += decoder.decode(value);

      startTransition(() => {
        addOptimisticMessage({ id: assistantId, role: 'assistant', text: assistantText });
      });
    }

    // commit the final state once, not per chunk
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text },
      { id: assistantId, role: 'assistant', text: assistantText },
    ]);
  }

  return (
    <div>
      {optimisticMessages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.text}
        </div>
      ))}
      <form action={sendMessage}>
        <input name="message" />
        <button>Send</button>
      </form>
    </div>
  );
}
```

**For:** instant feedback; native React 19, no library; automatic rollback; pairs well with Server
Actions.

**Against:** React 19+; does not replace real streaming; the mental model takes a moment.

**Use it when:** the server response almost always succeeds and perceived speed matters more than
precision.

---

## 8. ReadableStream API

**What it is:** the low-level web API underneath most of the libraries above. Verbose, maximally
flexible.

```ts
// classic reader
async function streamToElement(prompt: string, el: HTMLElement) {
  const response = await fetch('/api/stream', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      el.textContent += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

// modern: for-await, Node 18+ and current browsers
async function streamWithForAwait(prompt: string) {
  const response = await fetch('/api/stream', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });

  for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
    console.log(new TextDecoder().decode(chunk));
  }
}
```

A transform stream that parses SSE frames — note the buffer handling, which is where hand-rolled
implementations usually break:

```ts
function parseSSEStream(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      const reader = stream.getReader();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep the partial line for the next chunk
        for (const line of lines) {
          if (line.startsWith('data: ')) controller.enqueue(line.slice(6));
        }
      }
      controller.close();
    },
  });
}
```

**For:** total control; no dependencies; memory-efficient chunk-by-chunk processing; composable
through `TransformStream`.

**Against:** a lot of boilerplate; you own error handling and reconnection; edge cases are easy to get
wrong; older browsers.

**Use it when:** a custom protocol, a non-standard format, or you are writing the streaming library.

---

## 9. TanStack Query `streamedQuery`

**What it is:** experimental streaming support in TanStack Query v5 — caching and deduplication for
streaming queries.

```tsx
async function* fetchStreamingData(prompt: string) {
  const response = await fetch('/api/stream', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value);
  }
}

function StreamingComponent({ prompt }: { prompt: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stream', prompt],
    queryFn: streamedQuery({
      queryFn: () => fetchStreamingData(prompt),
      refetchMode: 'append', // or 'reset'
    }),
  });

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage />;
  return <div>{data}</div>;
}
```

**For:** streaming results get cached; deduplication across components; retry logic; DevTools; a
familiar API.

**Against:** experimental, so the API may move; less mature; overkill for a simple chat; thin
documentation.

**Use it when:** you are already on TanStack Query and want the streaming result cached.

---

## 10. Skeleton vs streaming as UX

Two different answers to "what does the user look at while waiting".

**Skeleton** — a placeholder shaped like the content:

```tsx
{
  isLoading && (
    <div className="animate-pulse space-y-2 max-w-sm">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
    </div>
  );
}
```

**Streaming** — the content itself, arriving progressively:

```tsx
<MessageBubble isStreaming={msg.isStreaming}>
  {msg.text}
  {msg.isStreaming && <span className="animate-pulse">▋</span>}
</MessageBubble>
```

| Situation                  | Approach              |
| -------------------------- | --------------------- |
| Loads in under a second    | Skeleton              |
| Long generated text (LLM)  | Streaming             |
| Images                     | Skeleton / blur-up    |
| Unknown duration, over 5 s | Spinner with progress |
| Real-time data             | Streaming             |
| Fixed, known structure     | Skeleton              |

**Rules that matter:**

- A skeleton must match the real structure, or you get layout shift — which is worse than no skeleton.
- An animated pulse reads better than a static block.
- Show a cursor while an LLM is generating.
- Do not mix skeleton and streaming inside the same block.

---

## Decision tree

```
Streaming LLM tokens?
├── Yes
│   ├── React / Next.js?
│   │   ├── Yes → Vercel AI SDK (useChat)      ← default
│   │   └── No  → SSE, or WebSocket directly
│   └── Must the client send data mid-stream?
│       ├── Yes → WebSocket
│       └── No  → SSE                          ← default for LLM
│
Complex chains / agents?          → LangChain.js or LangGraph
Full-stack TypeScript monorepo?   → tRPC subscriptions
SSR / SEO matters?                → RSC + Suspense
Need instant feedback?            → useOptimistic (React 19+)
Need streaming results cached?    → TanStack Query streamedQuery
Legacy app / no dependencies?     → ReadableStream directly
```

---

## Practices

1. **The Vercel AI SDK is the default for AI chat.** Production-tested, covers ~90% of cases.
2. **SSE is the standard for LLM streaming** — it is what OpenAI, Anthropic and Google use underneath.
3. **WebSocket only for bidirectional.** If you do not need a stop button or two-way traffic, do not
   take on the infrastructure.
4. **RSC + Suspense gives the best TTFB** when you do not need a real-time chat.
5. **`useOptimistic` for perceived speed.** Combine it with streaming rather than choosing between
   them.
6. **Skeletons must match the content structure**, or they cause the layout shift they exist to
   prevent.
7. **Persist the message once, when the stream finishes** — not per chunk. Otherwise you write to the
   database hundreds of times per response.
8. **Monitor Time to First Token.** It matters more than total response time: a first token at
   300–500 ms already feels fast, however long the rest takes.
9. **Handle reconnection.** `EventSource` does it for you; with fetch + SSE you implement retry with
   exponential backoff yourself.
10. **Send the headers first.** Emit `Content-Type: text/event-stream` and the first bytes
    immediately, so the browser starts rendering before the response completes.

---

## Comparison

| Approach                 | Complexity | Bundle  | Browser support | Bidirectional | LLM-ready |
| ------------------------ | ---------- | ------- | --------------- | :-----------: | :-------: |
| Vercel AI SDK            | Low        | ~50 KB  | ✅              |      ❌       |   ✅✅    |
| SSE (native)             | Medium     | 0       | ✅              |      ❌       |   ✅✅    |
| WebSocket                | High       | 0       | ✅              |      ✅       |    ✅     |
| RSC + Suspense           | High       | 0 (SSR) | ✅ (Next.js)    |      ❌       |    ⚠️     |
| LangChain.js             | High       | ~200 KB | ✅              |      ❌       |    ✅     |
| tRPC subscriptions       | Medium     | ~20 KB  | ✅              |      ✅       |    ✅     |
| `useOptimistic`          | Low        | 0       | React 19+       |      ❌       |    ✅     |
| ReadableStream           | High       | 0       | ✅              |      ❌       |    ✅     |
| TanStack `streamedQuery` | Medium     | ~15 KB  | ✅              |      ❌       |    ⚠️     |

---

## Sources

- [Vercel AI SDK](https://ai-sdk.dev/)
- [Anthropic — streaming messages](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [OpenAI — streaming responses](https://developers.openai.com/api/docs/guides/streaming-responses)
- [React Server Components](https://react.dev/reference/rsc/server-components)
- [tRPC subscriptions](https://trpc.io/docs/server/subscriptions)
- [TanStack Query `streamedQuery`](https://tanstack.com/query/v5/docs/reference/streamedQuery)
- [Server-Sent Events — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [ReadableStream — MDN](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
- [React 19 `useOptimistic`](https://react.dev/reference/react/useOptimistic)
- [LangChain.js streaming](https://js.langchain.com/docs/how_to/streaming/)
- [Linear — scaling the sync engine](https://linear.app/blog/scaling-the-linear-sync-engine)
