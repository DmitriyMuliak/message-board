/**
 * Default not-found page for 404 errors.
 * Deliberately minimal to avoid complex component rendering during prerendering.
 */
export default function NotFound() {
  return (
    <html lang="en">
      <head>
        <title>Not Found</title>
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Not found</h1>
          <p style={{ color: '#666', margin: 0, textAlign: 'center' }}>
            The page you&rsquo;re looking for doesn&rsquo;t exist.
          </p>
        </div>
      </body>
    </html>
  );
}
