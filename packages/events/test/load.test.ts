import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  AesGcmSecretProtector,
  InMemoryDeliveryStore,
  InMemorySubscriptionStore,
  SubscriptionService,
  WebhookDispatcher,
  type DeliveryTransport,
} from '../src/index.js';
import { actor, fixture, resolver } from './helpers.js';

describe('webhook bounded load', () => {
  it('fans out and dispatches fairly across five tenants without duplicate delivery IDs', async () => {
    const subscriptionStore = new InMemorySubscriptionStore();
    const subscriptions = new SubscriptionService({
      store: subscriptionStore,
      protector: new AesGcmSecretProtector(randomBytes(32)),
      resolver: resolver('8.8.8.8'),
    });
    for (let tenant = 0; tenant < 5; tenant += 1) {
      for (let endpoint = 0; endpoint < 2; endpoint += 1) {
        const principal = actor({ ownerId: `user-${tenant}`, tenantId: `tenant-${tenant}` });
        const issued = await subscriptions.create(principal, {
          endpoint: `https://hooks${endpoint}.example.com/tnl`,
          eventTypes: ['intelligence.published'],
        });
        await subscriptions.activate(principal, issued.subscription.id);
      }
    }
    const deliveries = new InMemoryDeliveryStore(2_000);
    const transport: DeliveryTransport = {
      send: async () => ({ status: 204, headers: {}, latencyMs: 1 }),
    };
    const dispatcher = new WebhookDispatcher({ subscriptions, deliveries, transport });
    for (let index = 0; index < 250; index += 1) {
      await dispatcher.fanout(
        fixture({
          id: `evt_load_${String(index).padStart(12, '0')}`,
          tenantId: `tenant-${index % 5}`,
          resource: { ...fixture().resource, id: `story-${index}` },
        }),
      );
    }
    assert.equal(deliveries.records.size, 500);
    assert.equal(new Set(deliveries.records.keys()).size, 500);
    let processed = 0;
    while (processed < 500) processed += await dispatcher.dispatchDue(50);
    assert.equal(
      [...deliveries.records.values()].filter((record) => record.state === 'succeeded').length,
      500,
    );
  });
});
