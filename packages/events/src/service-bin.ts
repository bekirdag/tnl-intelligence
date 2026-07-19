#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { WebhookChallengeService } from './challenge.js';
import { InMemoryDeliveryStore, WebhookDispatcher } from './delivery.js';
import { SystemEndpointResolver } from './endpoint.js';
import { WebhookMetrics } from './metrics.js';
import { createWebhookControlServer, DevelopmentHeaderAuthenticator } from './server.js';
import {
  AesGcmSecretProtector,
  InMemorySubscriptionStore,
  SubscriptionService,
} from './subscriptions.js';
import { PinnedHttpDeliveryTransport } from './transport.js';

if (process.env.TNL_WEBHOOK_DEV_SERVICE !== '1' || process.env.NODE_ENV === 'production') {
  throw new Error('The bundled webhook service uses in-memory adapters and is development-only');
}
const resolver = new SystemEndpointResolver();
const transport = new PinnedHttpDeliveryTransport(resolver);
const subscriptions = new SubscriptionService({
  store: new InMemorySubscriptionStore(),
  protector: new AesGcmSecretProtector(randomBytes(32)),
  resolver,
});
const metrics = new WebhookMetrics();
const dispatcher = new WebhookDispatcher({
  subscriptions,
  deliveries: new InMemoryDeliveryStore(),
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
const port = Number(process.env.TNL_WEBHOOK_SERVICE_PORT ?? 7322);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('invalid port');
server.listen(port, '127.0.0.1', () => {
  console.log(`TNL development webhook service listening on http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
