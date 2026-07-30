#!/usr/bin/env node
/**
 * Production canary receiver.
 *
 * Runs on the production host behind a public HTTPS hostname and verifies every
 * delivery with the shipped `verifyWebhook` helper, so the canary proves the
 * real signing path rather than a mock. The control surface listens on loopback
 * only; nginx exposes nothing but the `/hook` path.
 *
 *   TNL_WEBHOOK_DIST=/srv/tnl-webhooks/current/dist/index.js \
 *   node scripts/webhook-canary-receiver.mjs
 */
import { createServer } from 'node:http';

const distributionPath = process.env.TNL_WEBHOOK_DIST ?? '/srv/tnl-webhooks/current/dist/index.js';
const { verifyWebhook, VerificationError } = await import(distributionPath);

const port = Number(process.env.TNL_CANARY_PORT ?? 7325);
const state = {
  mode: 'ok',
  keys: {},
  // Mirrors how the Zapier connector verifies: it holds one pre-shared secret
  // and accepts whichever key id the delivery carries.
  defaultSecret: null,
  observations: [],
  // Raw body and headers of the newest verified delivery, so the same bytes can
  // be re-verified by the Python helper as cross-language evidence.
  lastSigned: null,
  duplicates: [],
  failures: [],
  attemptsByDelivery: {},
};
const seenDeliveries = new Set();

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (request.method === 'GET' && url.pathname === '/state') {
    return json(response, 200, state);
  }
  if (request.method === 'POST' && url.pathname === '/control') {
    const body = await readJson(request);
    if (body.mode) state.mode = body.mode;
    if (body.keys) state.keys = { ...state.keys, ...body.keys };
    if (body.defaultSecret !== undefined) state.defaultSecret = body.defaultSecret;
    if (body.reset) {
      state.observations = [];
      state.lastSigned = null;
      state.duplicates = [];
      state.failures = [];
      state.attemptsByDelivery = {};
      seenDeliveries.clear();
    }
    return json(response, 200, {
      mode: state.mode,
      keys: Object.keys(state.keys),
      defaultSecret: Boolean(state.defaultSecret),
    });
  }
  if (request.method !== 'POST' || url.pathname !== '/hook') {
    return json(response, 404, { error: 'not_found' });
  }

  const rawBody = await readBody(request);
  const headerNames = Object.keys(request.headers).filter((name) =>
    name.toLowerCase().startsWith('tnl-'),
  );
  const keys = Object.fromEntries(
    Object.entries(state.keys).map(([id, secret]) => [id, Buffer.from(secret, 'base64url')]),
  );
  const suppliedKeyId = request.headers['tnl-webhook-key-id'];
  if (state.defaultSecret && typeof suppliedKeyId === 'string' && !keys[suppliedKeyId])
    keys[suppliedKeyId] = Buffer.from(state.defaultSecret, 'base64url');
  let verified;
  try {
    verified = await verifyWebhook({ rawBody, headers: request.headers, keys });
  } catch (error) {
    const code = error instanceof VerificationError ? error.code : 'invalid_request';
    state.failures.push({ code, at: new Date().toISOString(), headerNames });
    return json(response, 400, { error: { code } });
  }

  const event = JSON.parse(rawBody.toString('utf8'));
  const attempts = (state.attemptsByDelivery[verified.deliveryId] ?? 0) + 1;
  state.attemptsByDelivery[verified.deliveryId] = attempts;
  const record = {
    deliveryId: verified.deliveryId,
    keyId: verified.keyId,
    timestamp: verified.timestamp,
    attempt: attempts,
    attemptId: request.headers['tnl-webhook-attempt-id'] ?? null,
    eventId: event.id,
    eventType: event.type,
    schemaVersion: event.schemaVersion,
    tenantId: event.tenantId,
    headerNames: headerNames.sort(),
    receivedAt: new Date().toISOString(),
  };
  state.lastSigned = {
    rawBodyBase64: rawBody.toString('base64'),
    headers: Object.fromEntries(
      Object.entries(request.headers).filter(([name]) => name.toLowerCase().startsWith('tnl-')),
    ),
  };
  if (seenDeliveries.has(verified.deliveryId)) {
    // The documented idempotency contract: once a delivery ID has been accepted,
    // any repeat of it must not produce a second side effect.
    state.duplicates.push(record);
    return json(response, 200, { duplicate: true });
  }
  state.observations.push(record);

  const mode = state.mode;
  const scriptedFailures =
    typeof mode === 'string' && mode.startsWith('retry429:') ? Number(mode.split(':')[1]) : 0;
  if (mode === 'always429') {
    response.writeHead(429, { 'retry-after': '1' }).end();
    return undefined;
  }
  if (mode === 'fail500') {
    response.writeHead(500).end();
    return undefined;
  }
  if (scriptedFailures > 0 && attempts <= scriptedFailures) {
    response.writeHead(429, { 'retry-after': '1' }).end();
    return undefined;
  }
  // Only a 2xx marks the delivery as accepted, so a retry after a failure is a
  // retry and not a duplicate.
  seenDeliveries.add(verified.deliveryId);
  response.writeHead(204).end();
  return undefined;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`canary receiver listening on http://127.0.0.1:${port}/hook`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function readJson(request) {
  const raw = await readBody(request);
  return raw.length ? JSON.parse(raw.toString('utf8')) : {};
}

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  return undefined;
}
