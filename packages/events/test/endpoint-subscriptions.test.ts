import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  AesGcmSecretProtector,
  EndpointPolicyError,
  InMemorySubscriptionStore,
  MemoryWebhookAuditSink,
  SubscriptionError,
  SubscriptionService,
  validateEndpoint,
} from '../src/index.js';
import { actor, fixture, resolver } from './helpers.js';

describe('endpoint and subscription policy', () => {
  it('blocks credentials, non-TLS, ports, private ranges, and non-loopback local HTTP', async () => {
    await assert.rejects(
      () => validateEndpoint('https://user:pass@example.com/hook', resolver('8.8.8.8')),
      endpointError('credentials_forbidden'),
    );
    await assert.rejects(
      () => validateEndpoint('http://example.com/hook', resolver('8.8.8.8')),
      endpointError('https_required'),
    );
    await assert.rejects(
      () => validateEndpoint('https://example.com:8443/hook', resolver('8.8.8.8')),
      endpointError('port_forbidden'),
    );
    for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fd00::1']) {
      await assert.rejects(
        () => validateEndpoint('https://example.com/hook', resolver(address)),
        endpointError('destination_prohibited'),
      );
    }
    const local = await validateEndpoint('http://localhost:7321/webhook', resolver('127.0.0.1'), {
      allowLocalHttp: true,
      allowedPorts: [7321],
    });
    assert.equal(local.addresses[0], '127.0.0.1');
    await assert.rejects(
      () =>
        validateEndpoint('http://example.com:7321/webhook', resolver('8.8.8.8'), {
          allowLocalHttp: true,
          allowedPorts: [7321],
        }),
      endpointError('local_http_not_loopback'),
    );
  });

  it('keeps secrets encrypted, filters events, rotates with overlap, and isolates tenants', async () => {
    const store = new InMemorySubscriptionStore();
    const audit = new MemoryWebhookAuditSink();
    const service = new SubscriptionService({
      store,
      protector: new AesGcmSecretProtector(randomBytes(32)),
      resolver: resolver('8.8.8.8'),
      now: () => Date.UTC(2026, 6, 18, 12),
      audit,
    });
    const issued = await service.create(actor(), {
      endpoint: 'https://hooks.example.com/tnl',
      eventTypes: ['intelligence.published'],
      filters: { categories: ['Technology'], minimumConfidence: 0.8 },
    });
    assert.equal(issued.secret.length >= 43, true);
    assert.ok(!JSON.stringify(store.records).includes(issued.secret));
    assert.ok(!JSON.stringify(await service.list(actor())).includes('ciphertext'));
    await service.activate(actor(), issued.subscription.id);
    assert.equal((await service.matching(fixture())).length, 1);
    assert.equal(
      (await service.matching(fixture({ data: { ...fixture().data, confidence: 0.5 } }))).length,
      0,
    );
    const oldKey = (await service.signingKeys(issued.subscription.id)).active.id;
    const rotated = await service.rotate(actor(), issued.subscription.id, 60);
    const keys = await service.signingKeys(issued.subscription.id);
    assert.notEqual(keys.active.id, oldKey);
    assert.ok(keys.verify[oldKey]);
    assert.ok(!JSON.stringify(await service.list(actor())).includes(rotated.secret));
    await assert.rejects(
      () => service.pause({ ...actor(), tenantId: 'other' }, issued.subscription.id),
      subscriptionError('not_found'),
    );
    await service.delete(actor(), issued.subscription.id);
    assert.equal((await store.get(issued.subscription.id))?.activeKey.ciphertext, '');
    assert.equal((await service.matching(fixture())).length, 0);
    assert.deepEqual(
      audit.events.map((event) => event.action),
      [
        'subscription_created',
        'subscription_activated',
        'subscription_rotated',
        'subscription_deleted',
      ],
    );
    assert.ok(!JSON.stringify(audit.events).includes(issued.secret));
  });

  it('accepts only canonical base64url caller secrets and preserves their key bytes', async () => {
    const store = new InMemorySubscriptionStore();
    const service = new SubscriptionService({
      store,
      protector: new AesGcmSecretProtector(randomBytes(32)),
      resolver: resolver('8.8.8.8'),
    });
    const bytes = randomBytes(32);
    const supplied = bytes.toString('base64url');
    const issued = await service.create(actor(), {
      endpoint: 'https://hooks.example.com/tnl',
      eventTypes: ['intelligence.published'],
      secret: supplied,
    });
    assert.equal(issued.secret, supplied);
    await service.activate(actor(), issued.subscription.id);
    assert.deepEqual((await service.signingKeys(issued.subscription.id)).active.secret, bytes);
    for (const invalid of ['x'.repeat(42), `${supplied}=`, '*'.repeat(43)]) {
      await assert.rejects(
        () =>
          service.create(actor(), {
            endpoint: 'https://hooks.example.com/tnl',
            eventTypes: ['intelligence.published'],
            secret: invalid,
          }),
        subscriptionError('invalid_secret'),
      );
    }
  });
});

function endpointError(code: string): (value: unknown) => boolean {
  return (value) => value instanceof EndpointPolicyError && value.code === code;
}

function subscriptionError(code: string): (value: unknown) => boolean {
  return (value) => value instanceof SubscriptionError && value.code === code;
}
