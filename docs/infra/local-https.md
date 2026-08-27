# HTTPS on localhost

Some things only work over TLS — service workers, `crypto.subtle`, secure cookies, a payment SDK's
sandbox. This is how to get a trusted certificate locally without the browser's "Not Secure" warning.

## Step 1 — a locally trusted certificate

Use [`mkcert`](https://github.com/FiloSottile/mkcert). Unlike a hand-rolled self-signed certificate,
it installs a local certificate authority into the system and browser trust stores, so the padlock is
green instead of scary.

**macOS / Linux**

```bash
brew install mkcert nss
```

**Windows (Chocolatey)**

```bash
choco install mkcert
```

Then install the local CA — once per machine:

```bash
mkcert -install
```

And issue the certificate:

```bash
mkcert localhost
```

That writes two files into the current directory:

```
localhost.pem        # the certificate
localhost-key.pem    # the private key
```

Both are secrets in the sense that they should not be committed — add them to `.gitignore`.

## Step 2 — serve over them

### Next.js

Next has supported this natively since 13.5:

```bash
next dev --experimental-https
```

It will generate and trust a certificate for you. Pass your own with
`--experimental-https-key ./localhost-key.pem --experimental-https-cert ./localhost.pem` if you
already made one with `mkcert`.

### Vite

```ts
// vite.config.ts
import fs from 'node:fs';

export default {
  server: {
    https: {
      key: fs.readFileSync('localhost-key.pem'),
      cert: fs.readFileSync('localhost.pem'),
    },
  },
};
```

### A plain Node server, with Express

```js
// server.js
import https from 'node:https';
import fs from 'node:fs';
import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('HTTPS server running on localhost:3000');
});

const options = {
  key: fs.readFileSync('./localhost-key.pem'),
  cert: fs.readFileSync('./localhost.pem'),
};

https.createServer(options, app).listen(3000, () => {
  console.log('HTTPS server started on https://localhost:3000');
});
```

### A plain Node server, without Express

```js
// server.js
import https from 'node:https';
import fs from 'node:fs';

const options = {
  key: fs.readFileSync('./localhost-key.pem'),
  cert: fs.readFileSync('./localhost.pem'),
};

https
  .createServer(options, (req, res) => {
    res.writeHead(200);
    res.end('Hello from pure Node.js HTTPS');
  })
  .listen(3000, () => console.log('HTTPS running on https://localhost:3000'));
```

## The alternative — a tunnel

If you need a **publicly reachable** HTTPS URL rather than a local one — testing a webhook, an OAuth
redirect, or a device on another network — a tunnel is simpler than a certificate:

- `ngrok http 3000`
- `cloudflared tunnel --url http://localhost:3000`
- `localtunnel`

These terminate TLS on their side, so nothing changes in your app. The cost is that traffic leaves
your machine, which matters if the data is real.
