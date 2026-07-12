'use client';

import { useEffect } from 'react';

/**
 * Root-level error boundary for unrecoverable errors (§14 of ARCHITECTURE.md).
 *
 * This is a minimal client component that handles catastrophic errors outside
 * the normal page hierarchy. Unlike error.tsx boundaries, it must import and
 * render <html> and <body> tags since no parent layout wraps it.
 *
 * Kept intentionally simple: no providers, no router, no complex state — just
 * a fallback UI and basic error logging. No external CSS or styles to keep
 * the dependency tree minimal during prerendering.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Only log in browser context to avoid SSR issues
    if (typeof console !== 'undefined') {
      console.error('Global error:', error);
    }
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          backgroundColor: '#fff',
          color: '#111',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          margin: 0,
          padding: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1rem',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Something broke</h1>
          <p
            style={{
              color: '#666',
              maxWidth: '448px',
              textAlign: 'center',
              margin: 0,
            }}
          >
            An unexpected error occurred. Try refreshing the page or{' '}
            <button
              onClick={() => reset()}
              style={{
                background: 'none',
                border: 'none',
                textDecoration: 'underline',
                cursor: 'pointer',
                color: '#111',
              }}
            >
              recovering
            </button>
            .
          </p>
          {process.env.NODE_ENV === 'development' && error && (
            <details
              style={{
                marginTop: '1rem',
                width: '100%',
                maxWidth: '448px',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                }}
              >
                Error details (dev only)
              </summary>
              <pre
                style={{
                  marginTop: '0.5rem',
                  overflow: 'auto',
                  backgroundColor: '#f3f3f3',
                  padding: '0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}
        </div>
      </body>
    </html>
  );
}
