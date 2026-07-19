import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { WebhookChallengeService } from './challenge.js';
import { createWebhookEvent } from './contracts.js';
import type { WebhookDispatcher } from './delivery.js';
import type { WebhookEventType } from './generated/events.js';
import type { SubscriptionFilters } from './filters.js';
import type { WebhookMetrics } from './metrics.js';
import {
  SubscriptionError,
  type SubscriptionActor,
  type SubscriptionService,
} from './subscriptions.js';

export interface ControlAuthenticator {
  authenticate(request: IncomingMessage): Promise<SubscriptionActor>;
}

export class DevelopmentHeaderAuthenticator implements ControlAuthenticator {
  async authenticate(request: IncomingMessage): Promise<SubscriptionActor> {
    const ownerId = one(request.headers['x-tnl-user']);
    const tenantId = one(request.headers['x-tnl-tenant']);
    if (!ownerId || !tenantId) throw new SubscriptionError('authentication_required', 401);
    return {
      ownerId,
      tenantId,
      canReplay: one(request.headers['x-tnl-operator']) === '1',
    };
  }
}

export function createWebhookControlServer(options: {
  subscriptions: SubscriptionService;
  dispatcher: WebhookDispatcher;
  challenge: WebhookChallengeService;
  identity: ControlAuthenticator;
  metrics: WebhookMetrics;
  now?: () => number;
  ready?: () => Promise<boolean>;
}): Server {
  const now = options.now ?? Date.now;
  return createServer(
    { maxHeaderSize: 16_384, requestTimeout: 15_000 },
    async (request, response) => {
      response.setHeader('x-content-type-options', 'nosniff');
      response.setHeader('cache-control', 'no-store');
      try {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        if (request.method === 'GET' && url.pathname === '/healthz') {
          json(response, 200, { ok: true, service: 'tnl-webhooks' });
          return;
        }
        if (request.method === 'GET' && url.pathname === '/readyz') {
          const ready = (await options.ready?.()) ?? true;
          json(response, ready ? 200 : 503, { ready });
          return;
        }
        if (request.method === 'GET' && url.pathname === '/metrics') {
          response
            .writeHead(200, { 'content-type': 'text/plain; version=0.0.4' })
            .end(options.metrics.prometheus());
          return;
        }
        if (!url.pathname.startsWith('/v1/webhooks/')) {
          json(response, 404, errorBody('not_found'));
          return;
        }
        const actor = await options.identity.authenticate(request);
        if (url.pathname === '/v1/webhooks/subscriptions') {
          if (request.method === 'GET') {
            json(response, 200, { data: await options.subscriptions.list(actor) });
            return;
          }
          if (request.method === 'POST') {
            const body = await readBody(request, 16_384);
            const filters = object(body.filters) as SubscriptionFilters | undefined;
            const issued = await options.subscriptions.create(actor, {
              endpoint: string(body.endpoint),
              eventTypes: strings(body.eventTypes) as WebhookEventType[],
              ...(filters ? { filters } : {}),
              ...(body.secret === undefined ? {} : { secret: string(body.secret) }),
            });
            json(response, 201, { data: issued });
            return;
          }
        }
        const subscription = url.pathname.match(
          /^\/v1\/webhooks\/subscriptions\/([^/]+)(?:\/(verify|pause|rotate|test))?$/,
        );
        if (subscription) {
          const id = decodeURIComponent(subscription[1] as string);
          const action = subscription[2];
          if (request.method === 'POST' && action === 'verify') {
            await options.challenge.verify(actor, id);
            json(response, 200, { data: await options.subscriptions.inspect(actor, id) });
            return;
          }
          if (request.method === 'POST' && action === 'pause') {
            json(response, 200, { data: await options.subscriptions.pause(actor, id) });
            return;
          }
          if (request.method === 'POST' && action === 'rotate') {
            const body = await readBody(request, 4_096);
            const overlap =
              body.overlapSeconds === undefined ? 86_400 : Number(body.overlapSeconds);
            json(response, 200, {
              data: await options.subscriptions.rotate(actor, id, overlap),
            });
            return;
          }
          if (request.method === 'POST' && action === 'test') {
            await options.subscriptions.inspect(actor, id);
            const timestamp = now();
            const event = testEvent(id, actor.tenantId, timestamp);
            await options.dispatcher.fanoutTo(event, id);
            json(response, 202, { data: { eventId: event.id } });
            return;
          }
          if (request.method === 'DELETE' && !action) {
            await options.subscriptions.delete(actor, id);
            response.writeHead(204).end();
            return;
          }
        }
        if (request.method === 'GET' && url.pathname === '/v1/webhooks/deliveries') {
          const subscriptionId = url.searchParams.get('subscription_id') ?? undefined;
          json(response, 200, { data: await options.dispatcher.history(actor, subscriptionId) });
          return;
        }
        const replay = url.pathname.match(/^\/v1\/webhooks\/deliveries\/([^/]+)\/replay$/);
        if (request.method === 'POST' && replay) {
          json(response, 202, {
            data: await options.dispatcher.replay(actor, decodeURIComponent(replay[1] as string)),
          });
          return;
        }
        json(response, 404, errorBody('not_found'));
      } catch (error) {
        const status = error instanceof SubscriptionError ? error.status : 500;
        const code = error instanceof SubscriptionError ? error.code : 'internal_error';
        json(response, status, errorBody(code));
      }
    },
  );
}

function testEvent(id: string, tenantId: string, timestamp: number) {
  return createWebhookEvent({
    id: `evt_${createHash('sha256').update(`${id}\u0000${timestamp}`).digest('base64url').slice(0, 24)}`,
    type: 'subscription.test',
    tenantId,
    occurredAt: new Date(timestamp).toISOString(),
    publishedAt: new Date(timestamp).toISOString(),
    traceId: `manual-test-${id}`.slice(0, 120),
    resource: {
      id,
      revision: 1,
      url: 'https://theneuralledger.com/developers/webhooks',
    },
    data: {
      summary: 'Authorized manual TNL test event.',
      categories: [],
      geographies: [],
      entities: [],
      assets: [],
      impactPaths: [],
      provenance: ['https://theneuralledger.com/developers/webhooks'],
    },
  });
}

async function readBody(
  request: AsyncIterable<unknown>,
  maximum: number,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    length += value.length;
    if (length > maximum) throw new SubscriptionError('body_too_large', 413);
    chunks.push(value);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new SubscriptionError('invalid_json', 400);
  }
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

function errorBody(code: string): { error: { code: string; message: string } } {
  return { error: { code, message: code.replaceAll('_', ' ') } };
}

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' && value.length <= 160 ? value : undefined;
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new SubscriptionError('invalid_request', 400);
  return value;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string'))
    throw new SubscriptionError('invalid_request', 400);
  return value;
}

function object(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new SubscriptionError('invalid_request', 400);
  return value as Record<string, unknown>;
}
