import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  AesGcmSecretProtector,
  InMemoryDeliveryStore,
  InMemorySubscriptionStore,
  PinnedHttpDeliveryTransport,
  SubscriptionService,
  WebhookDispatcher,
  type EndpointResolver,
} from '../src/index.js';
import { actor, fixture } from './helpers.js';

describe('webhook destination security', () => {
  it('rechecks DNS at send time and disables a destination that changes to private space', async () => {
    let lookups = 0;
    const resolver: EndpointResolver = {
      resolve: async () => (++lookups === 1 ? ['8.8.8.8'] : ['127.0.0.1']),
    };
    const store = new InMemorySubscriptionStore();
    const subscriptions = new SubscriptionService({
      store,
      protector: new AesGcmSecretProtector(randomBytes(32)),
      resolver,
    });
    const issued = await subscriptions.create(actor(), {
      endpoint: 'https://hooks.example.com/tnl',
      eventTypes: ['intelligence.published'],
    });
    await subscriptions.activate(actor(), issued.subscription.id);
    const deliveries = new InMemoryDeliveryStore();
    const dispatcher = new WebhookDispatcher({
      subscriptions,
      deliveries,
      transport: new PinnedHttpDeliveryTransport(resolver),
    });
    await dispatcher.fanout(fixture());
    await dispatcher.dispatchDue();
    const record = [...deliveries.records.values()][0]!;
    assert.equal(record.state, 'terminal');
    assert.equal(record.lastErrorCode, 'destination_prohibited');
    assert.equal((await subscriptions.deliveryTarget(issued.subscription.id)).state, 'disabled');
    assert.equal(dispatcher.metrics.snapshot().counters.destination_blocked, 1);
  });
});
