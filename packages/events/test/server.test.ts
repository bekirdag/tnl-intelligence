import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { type Server } from 'node:http';
import { afterEach, describe, it } from 'node:test';
import {
  AesGcmSecretProtector,
  DevelopmentHeaderAuthenticator,
  InMemoryDeliveryStore,
  InMemorySubscriptionStore,
  SubscriptionService,
  WebhookChallengeService,
  WebhookDispatcher,
  WebhookMetrics,
  createWebhookControlServer,
  type DeliveryTransport,
  type DeliveryTransportRequest,
  type DeliveryTransportResponse,
} from '../src/index.js';
import { resolver } from './helpers.js';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

describe('webhook control plane', () => {
  it('requires identity and supports challenge, test, history, replay, rotation, pause, and deletion', async () => {
    const transport = new SuccessTransport();
    const subscriptionStore = new InMemorySubscriptionStore();
    const subscriptions = new SubscriptionService({
      store: subscriptionStore,
      protector: new AesGcmSecretProtector(randomBytes(32)),
      resolver: resolver('8.8.8.8'),
    });
    const deliveries = new InMemoryDeliveryStore();
    const metrics = new WebhookMetrics();
    const dispatcher = new WebhookDispatcher({
      subscriptions,
      deliveries,
      transport,
      metrics,
    });
    const server = createWebhookControlServer({
      subscriptions,
      dispatcher,
      challenge: new WebhookChallengeService(subscriptions, transport),
      identity: new DevelopmentHeaderAuthenticator(),
      metrics,
    });
    const baseUrl = await listen(server);
    assert.equal((await fetch(`${baseUrl}/healthz`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/readyz`)).status, 200);
    assert.match(await (await fetch(`${baseUrl}/metrics`)).text(), /tnl_webhook_queue_depth/);
    assert.equal((await fetch(`${baseUrl}/v1/webhooks/subscriptions`)).status, 401);

    const created = await control(baseUrl, '/v1/webhooks/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: 'https://hooks.example.com/tnl',
        eventTypes: ['intelligence.published'],
      }),
    });
    assert.equal(created.status, 201);
    const issued = (await created.json()).data;
    assert.ok(issued.secret);
    const id = issued.subscription.id as string;
    const listed = await (await control(baseUrl, '/v1/webhooks/subscriptions')).json();
    assert.equal(listed.data.length, 1);
    assert.ok(!JSON.stringify(listed).includes(issued.secret));
    assert.ok(!JSON.stringify(listed).includes('ciphertext'));

    const verified = await control(baseUrl, `/v1/webhooks/subscriptions/${id}/verify`, {
      method: 'POST',
    });
    assert.equal(verified.status, 200);
    assert.equal((await verified.json()).data.state, 'active');
    assert.equal(transport.requests.length, 1);

    assert.equal(
      (
        await control(baseUrl, `/v1/webhooks/subscriptions/${id}/test`, {
          method: 'POST',
        })
      ).status,
      202,
    );
    await dispatcher.dispatchDue();
    assert.equal(transport.requests.length, 2);
    const history = await (await control(baseUrl, '/v1/webhooks/deliveries')).json();
    assert.equal(history.data.length, 1);
    assert.equal(history.data[0].event.data.summary, '');
    const deliveryId = history.data[0].id as string;
    assert.equal(
      (
        await control(baseUrl, `/v1/webhooks/deliveries/${deliveryId}/replay`, {
          method: 'POST',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await control(
          baseUrl,
          `/v1/webhooks/deliveries/${deliveryId}/replay`,
          { method: 'POST' },
          true,
        )
      ).status,
      202,
    );
    const rotated = await control(baseUrl, `/v1/webhooks/subscriptions/${id}/rotate`, {
      method: 'POST',
      body: JSON.stringify({ overlapSeconds: 60 }),
    });
    assert.equal(rotated.status, 200);
    assert.ok((await rotated.json()).data.secret);
    assert.equal(
      (
        await control(baseUrl, `/v1/webhooks/subscriptions/${id}/pause`, {
          method: 'POST',
        })
      ).status,
      200,
    );
    assert.deepEqual(
      (
        await (
          await control(baseUrl, '/v1/webhooks/subscriptions', {}, false, 'tenant-other')
        ).json()
      ).data,
      [],
    );
    assert.equal(
      (
        await control(baseUrl, `/v1/webhooks/subscriptions/${id}`, {
          method: 'DELETE',
        })
      ).status,
      204,
    );
  });
});

class SuccessTransport implements DeliveryTransport {
  readonly requests: DeliveryTransportRequest[] = [];

  async send(request: DeliveryTransportRequest): Promise<DeliveryTransportResponse> {
    this.requests.push(request);
    return { status: 204, headers: {}, latencyMs: 1 };
  }
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  servers.push(server);
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

function control(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  operator = false,
  tenant = 'tenant-1',
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-tnl-user': 'user-1',
      'x-tnl-tenant': tenant,
      ...(operator ? { 'x-tnl-operator': '1' } : {}),
      ...(init.headers ?? {}),
    },
  });
}
