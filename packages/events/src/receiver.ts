import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { InMemoryReplayStore, VerificationError, verifyWebhook } from './signing.js';

export interface LocalReceiverObservation {
  deliveryId: string;
  eventId: string;
  eventType: string;
  receivedAt: string;
}

export function createLocalWebhookReceiver(options: {
  keys: Readonly<Record<string, string | Buffer>>;
  allowDevelopmentHttp: boolean;
  status?: number | ((attempt: number) => number);
  delayMs?: number;
  now?: () => number;
  observations?: LocalReceiverObservation[];
  errors?: string[];
}): Server {
  if (!options.allowDevelopmentHttp)
    throw new Error('Local HTTP receiver requires allowDevelopmentHttp=true');
  const replay = new InMemoryReplayStore();
  const observations = options.observations ?? [];
  let attempts = 0;
  return createServer(
    { maxHeaderSize: 16_384, requestTimeout: 15_000 },
    async (request, response) => {
      if (request.method === 'GET' && request.url === '/healthz') {
        response.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
        return;
      }
      if (request.method !== 'POST' || request.url !== '/webhook') {
        response.writeHead(404).end();
        return;
      }
      try {
        const rawBody = await body(request, 64 * 1024);
        const verified = await verifyWebhook({
          rawBody,
          headers: normalizeHeaders(request.headers),
          keys: options.keys,
          replayStore: replay,
          now: Math.floor((options.now ?? Date.now)() / 1_000),
        });
        const event = JSON.parse(rawBody.toString('utf8')) as {
          id?: unknown;
          type?: unknown;
        };
        observations.push({
          deliveryId: verified.deliveryId,
          eventId: typeof event.id === 'string' ? event.id : 'invalid',
          eventType: typeof event.type === 'string' ? event.type : 'invalid',
          receivedAt: new Date((options.now ?? Date.now)()).toISOString(),
        });
        attempts += 1;
        if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        const status =
          typeof options.status === 'function' ? options.status(attempts) : (options.status ?? 204);
        response.writeHead(status).end();
      } catch (error) {
        if (error instanceof VerificationError && error.code === 'duplicate_delivery') {
          response.writeHead(204).end();
          return;
        }
        const code = error instanceof VerificationError ? error.code : 'invalid_request';
        options.errors?.push(code);
        response
          .writeHead(400, { 'content-type': 'application/json' })
          .end(JSON.stringify({ error: { code } }));
      }
    },
  );
}

async function body(request: AsyncIterable<unknown>, maximum: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    length += value.length;
    if (length > maximum) throw new Error('body_too_large');
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function normalizeHeaders(
  headers: IncomingHttpHeaders,
): Record<string, string | string[] | undefined> {
  return Object.fromEntries(Object.entries(headers));
}
