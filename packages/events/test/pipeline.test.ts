import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { type Server } from 'node:http';
import { afterEach, describe, it } from 'node:test';
import {
  AesGcmSecretProtector,
  FairEventQueue,
  InMemoryDeliveryStore,
  InMemoryOutboxStore,
  InMemorySubscriptionStore,
  OutboxRelay,
  PinnedHttpDeliveryTransport,
  SubscriptionService,
  WebhookDispatcher,
  WebhookProducer,
  retryDelay,
  createLocalWebhookReceiver,
  type DeliveryTransport,
  type DeliveryTransportRequest,
  type DeliveryTransportResponse,
  type LocalReceiverObservation,
} from '../src/index.js';
import { actor, fixture, resolver } from './helpers.js';

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

describe('outbox and delivery pipeline', () => {
  it('deduplicates outbox/queue work and rotates tenants fairly', async () => {
    const outbox = new InMemoryOutboxStore();
    const producer = new WebhookProducer(true);
    const one = fixture();
    const two = fixture({ id: 'evt_fixture222222222', tenantId: 'tenant-2' });
    const three = fixture({
      id: 'evt_fixture333333333',
      resource: { ...one.resource, revision: 2 },
    });
    assert.equal(await producer.stage(outbox, one), true);
    assert.equal(await producer.stage(outbox, one), false);
    assert.equal(await producer.stage(outbox, two), true);
    assert.equal(await producer.stage(outbox, three), true);
    const queue = new FairEventQueue();
    const relay = new OutboxRelay(outbox, queue, 'worker-1');
    assert.equal(await relay.runOnce(Date.UTC(2026, 6, 18, 12)), 3);
    assert.equal(queue.size(), 3);
    assert.equal((await queue.dequeue())?.tenantId, 'tenant-1');
    assert.equal((await queue.dequeue())?.tenantId, 'tenant-2');
    assert.equal((await queue.dequeue())?.tenantId, 'tenant-1');
    assert.equal((await outbox.reconcile(Date.UTC(2026, 6, 18, 13))).length, 0);
  });

  it('recovers an expired outbox lease without making an early duplicate lease', async () => {
    const outbox = new InMemoryOutboxStore();
    await new WebhookProducer(true).stage(outbox, fixture());
    assert.equal((await outbox.lease('crashed-worker', 1_000, 100, 10)).length, 1);
    assert.equal((await outbox.lease('early-worker', 1_050, 100, 10)).length, 0);
    assert.equal((await outbox.lease('recovery-worker', 1_101, 100, 10)).length, 1);
  });

  it('retains committed events across a queue outage and keeps publication decoupled', async () => {
    const outbox = new InMemoryOutboxStore();
    assert.equal(await new WebhookProducer(true).stage(outbox, fixture()), true);
    const unavailableQueue = {
      async enqueue() {
        throw new Error('queue unavailable');
      },
      async dequeue() {
        return undefined;
      },
      size() {
        return 0;
      },
    };
    const failedRelay = new OutboxRelay(outbox, unavailableQueue, 'failed-relay', 100);
    await assert.rejects(() => failedRelay.runOnce(1_000), /queue unavailable/);
    assert.equal((await outbox.reconcile(1_050)).length, 0);

    const recoveredQueue = new FairEventQueue();
    const recoveredRelay = new OutboxRelay(outbox, recoveredQueue, 'recovered-relay', 100);
    assert.equal(await recoveredRelay.runOnce(1_101), 1);
    assert.equal(recoveredQueue.size(), 1);
    assert.equal((await recoveredQueue.dequeue())?.id, fixture().id);

    const disabledOutbox = new InMemoryOutboxStore();
    assert.equal(await new WebhookProducer(false).stage(disabledOutbox, fixture()), false);
    assert.equal(disabledOutbox.records.size, 0);
  });

  it('caps excessive Retry-After and uses bounded backoff for malformed values', () => {
    const policy = {
      maximumAttempts: 8,
      baseDelayMs: 5_000,
      maximumDelayMs: 60_000,
      maximumRetryAfterMs: 30_000,
      requestTimeoutMs: 10_000,
    };
    assert.equal(
      retryDelay(1, 3_600_000, policy, () => 0.5),
      30_000,
    );
    assert.equal(
      retryDelay(2, undefined, policy, () => 0.5),
      10_000,
    );
  });

  it('retries bounded 429/5xx outcomes, succeeds, deduplicates fanout, and authorizes replay', async () => {
    let now = Date.UTC(2026, 6, 18, 12);
    const { service, subscriptionId } = await subscription(now);
    const deliveries = new InMemoryDeliveryStore();
    const transport = new SequenceTransport([
      { status: 429, headers: { 'retry-after': '2' }, latencyMs: 4 },
      { status: 503, headers: {}, latencyMs: 5 },
      { status: 204, headers: {}, latencyMs: 3 },
    ]);
    const dispatcher = new WebhookDispatcher({
      subscriptions: service,
      deliveries,
      transport,
      now: () => now,
      random: () => 0.5,
      retryPolicy: { baseDelayMs: 1_000 },
    });
    assert.equal(await dispatcher.fanout(fixture()), 1);
    assert.equal(await dispatcher.fanout(fixture()), 0);
    await dispatcher.dispatchDue();
    let record = [...deliveries.records.values()][0]!;
    assert.equal(record.state, 'retry_scheduled');
    assert.equal(record.nextAttemptAt, now + 2_000);
    now = record.nextAttemptAt;
    await dispatcher.dispatchDue();
    record = [...deliveries.records.values()][0]!;
    assert.equal(record.state, 'retry_scheduled');
    now = record.nextAttemptAt;
    await dispatcher.dispatchDue();
    record = [...deliveries.records.values()][0]!;
    assert.equal(record.state, 'succeeded');
    assert.equal(record.attempts, 3);
    await assert.rejects(() => dispatcher.replay(actor(), record.id), /replay_forbidden/);
    await dispatcher.replay(actor({ canReplay: true }), record.id);
    assert.equal((await dispatcher.history(actor(), subscriptionId))[0]?.event.data.summary, '');
    assert.equal(dispatcher.metrics.snapshot().counters.delivery_replayed, 1);
  });

  it('dead-letters exhausted retries and disables terminal or prohibited destinations', async () => {
    let now = Date.UTC(2026, 6, 18, 12);
    const retry = await subscription(now);
    const retryStore = new InMemoryDeliveryStore();
    const retryDispatcher = new WebhookDispatcher({
      subscriptions: retry.service,
      deliveries: retryStore,
      transport: new SequenceTransport([
        { status: 500, headers: {}, latencyMs: 1 },
        { status: 500, headers: {}, latencyMs: 1 },
      ]),
      now: () => now,
      random: () => 0,
      retryPolicy: { maximumAttempts: 2, baseDelayMs: 1 },
    });
    await retryDispatcher.fanout(fixture());
    await retryDispatcher.dispatchDue();
    now = [...retryStore.records.values()][0]!.nextAttemptAt;
    await retryDispatcher.dispatchDue();
    assert.equal([...retryStore.records.values()][0]?.state, 'dead_letter');

    const terminal = await subscription(now);
    const terminalStore = new InMemoryDeliveryStore();
    const terminalDispatcher = new WebhookDispatcher({
      subscriptions: terminal.service,
      deliveries: terminalStore,
      transport: new SequenceTransport([{ status: 410, headers: {}, latencyMs: 1 }]),
      now: () => now,
    });
    await terminalDispatcher.fanout(fixture());
    await terminalDispatcher.dispatchDue();
    assert.equal([...terminalStore.records.values()][0]?.state, 'terminal');
    assert.equal(
      (await terminal.service.deliveryTarget(terminal.subscriptionId)).state,
      'disabled',
    );
  });

  it('pins a revalidated loopback address and delivers to a real raw-body verifier', async () => {
    const observations: LocalReceiverObservation[] = [];
    const errors: string[] = [];
    const setup = await subscription(Date.now(), true);
    const key = await setup.service.signingKeys(setup.subscriptionId);
    const receiver = createLocalWebhookReceiver({
      keys: key.verify,
      allowDevelopmentHttp: true,
      observations,
      errors,
    });
    await listen(receiver);
    const address = receiver.address();
    assert.ok(address && typeof address !== 'string');
    const record = setup.store.records.get(setup.subscriptionId)!;
    record.endpoint = `http://localhost:${address.port}/webhook`;
    await setup.store.save(record);
    const deliveries = new InMemoryDeliveryStore();
    const dispatcher = new WebhookDispatcher({
      subscriptions: setup.service,
      deliveries,
      transport: new PinnedHttpDeliveryTransport(resolver('127.0.0.1'), {
        allowLocalHttp: true,
        allowedPorts: [address.port],
      }),
    });
    await dispatcher.fanout(fixture());
    await dispatcher.dispatchDue();
    const delivered = [...deliveries.records.values()][0];
    assert.equal(delivered?.state, 'succeeded', JSON.stringify({ delivered, errors }));
    assert.equal(observations.length, 1);
    assert.equal(observations[0]?.eventId, fixture().id);
  });
});

class SequenceTransport implements DeliveryTransport {
  readonly #responses: DeliveryTransportResponse[];

  constructor(responses: DeliveryTransportResponse[]) {
    this.#responses = responses;
  }

  async send(_request: DeliveryTransportRequest): Promise<DeliveryTransportResponse> {
    const response = this.#responses.shift();
    if (!response) throw new Error('no response configured');
    return response;
  }
}

async function subscription(now: number, local = false) {
  const store = new InMemorySubscriptionStore();
  const service = new SubscriptionService({
    store,
    protector: new AesGcmSecretProtector(randomBytes(32)),
    resolver: resolver(local ? '127.0.0.1' : '8.8.8.8'),
    endpointPolicy: local ? { allowLocalHttp: true, allowedPorts: [80] } : {},
    now: () => now,
  });
  const issued = await service.create(actor(), {
    endpoint: local ? 'http://localhost/webhook' : 'https://hooks.example.com/tnl',
    eventTypes: ['intelligence.published'],
  });
  await service.activate(actor(), issued.subscription.id);
  return { service, store, subscriptionId: issued.subscription.id };
}

async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  servers.push(server);
}
