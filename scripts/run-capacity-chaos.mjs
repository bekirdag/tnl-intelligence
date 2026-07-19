#!/usr/bin/env node
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  AesGcmSecretProtector,
  InMemoryDeliveryStore,
  InMemorySubscriptionStore,
  SubscriptionService,
  WebhookDispatcher,
  createWebhookEvent,
} from '../packages/events/dist/index.js';
import { InMemoryQuotaStore } from '../packages/gateway/dist/index.js';
import {
  DETERMINISTIC_RESEARCH_EVIDENCE,
  DeterministicCodaliAdapter,
  DeterministicEvidenceAdapter,
  ResearchOrchestrator,
  createDemoResearchTask,
} from '../packages/research/dist/index.js';
import { writeJsonAtomic } from './release-lib.mjs';

const thresholds = {
  profileDurationMs: 10_000,
  researchDurationMs: 15_000,
  retryRecoveryAttempts: 2,
  allowedPerTenantPerMinute: 5,
};
const evidence = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    topology: 'single-process deterministic loopback adapters',
  },
  thresholds,
  profiles: [],
  chaos: [],
};

for (const profile of [
  { id: 'baseline', events: 25, tenants: 2, endpoints: 1, batch: 25 },
  { id: 'expected-peak', events: 200, tenants: 5, endpoints: 2, batch: 100 },
  { id: 'burst', events: 500, tenants: 5, endpoints: 2, batch: 250 },
  { id: 'soak', events: 2_000, tenants: 10, endpoints: 1, batch: 250 },
]) {
  evidence.profiles.push(await webhookProfile(profile));
}
evidence.chaos.push(await retryStorm());
evidence.chaos.push(await quotaFairness());
evidence.chaos.push(await concurrentResearch());
evidence.state = [...evidence.profiles, ...evidence.chaos].every(({ state }) => state === 'pass')
  ? 'pass'
  : 'fail';
await writeJsonAtomic('.artifacts/tool-10/capacity-chaos-evidence.json', evidence);
assert.equal(evidence.state, 'pass');
console.log('Capacity and chaos qualification passed.');

async function webhookProfile(profile) {
  const startedAt = performance.now();
  const { subscriptions, deliveries, dispatcher } = await webhookRuntime(
    profile.tenants,
    profile.endpoints,
    async () => ({ status: 204, headers: {}, latencyMs: 1 }),
    profile.events * profile.endpoints + 100,
  );
  for (let index = 0; index < profile.events; index += 1) {
    await dispatcher.fanout(event(index, `tenant-${index % profile.tenants}`));
  }
  let processed = 0;
  while (processed < profile.events * profile.endpoints) {
    const count = await dispatcher.dispatchDue(profile.batch);
    assert.ok(count > 0, `${profile.id} stalled`);
    processed += count;
  }
  const records = [...deliveries.records.values()];
  assert.equal(records.length, profile.events * profile.endpoints);
  assert.ok(records.every(({ state }) => state === 'succeeded'));
  const tenantCounts = new Map();
  for (const record of records)
    tenantCounts.set(record.tenantId, (tenantCounts.get(record.tenantId) ?? 0) + 1);
  assert.equal(tenantCounts.size, profile.tenants);
  assert.ok(
    Math.max(...tenantCounts.values()) - Math.min(...tenantCounts.values()) <= profile.endpoints,
  );
  const durationMs = Math.round(performance.now() - startedAt);
  assert.ok(durationMs < thresholds.profileDurationMs, `${profile.id} took ${durationMs}ms`);
  return {
    ...profile,
    subscriptions: subscriptions.length,
    deliveries: records.length,
    durationMs,
    deliveriesPerSecond: Math.round((records.length / Math.max(durationMs, 1)) * 1_000),
    state: 'pass',
  };
}

async function retryStorm() {
  let now = Date.now();
  const attempts = new Map();
  const transport = async ({ headers }) => {
    const id = headers['TNL-Webhook-Id'];
    const attempt = (attempts.get(id) ?? 0) + 1;
    attempts.set(id, attempt);
    return { status: attempt === 1 ? 503 : 204, headers: {}, latencyMs: 1 };
  };
  const { deliveries, dispatcher } = await webhookRuntime(1, 1, transport, 200, {
    now: () => now,
    retryPolicy: { baseDelayMs: 1, maximumDelayMs: 10, maximumAttempts: 3 },
  });
  for (let index = 0; index < 100; index += 1)
    await dispatcher.fanout(event(index + 10_000, 'tenant-0'));
  assert.equal(await dispatcher.dispatchDue(200), 100);
  assert.ok([...deliveries.records.values()].every(({ state }) => state === 'retry_scheduled'));
  now += 20;
  assert.equal(await dispatcher.dispatchDue(200), 100);
  const records = [...deliveries.records.values()];
  assert.ok(records.every(({ state, attempts }) => state === 'succeeded' && attempts === 2));
  return {
    id: 'webhook-retry-storm',
    deliveries: records.length,
    totalAttempts: [...attempts.values()].reduce((sum, value) => sum + value, 0),
    lostCommittedEvents: 0,
    state: 'pass',
  };
}

async function quotaFairness() {
  const store = new InMemoryQuotaStore();
  const limits = {
    globalPerMinute: 10_000,
    tenantPerMinute: thresholds.allowedPerTenantPerMinute,
    principalPerMinute: thresholds.allowedPerTenantPerMinute,
    clientPerMinute: thresholds.allowedPerTenantPerMinute,
    researchPerMinute: thresholds.allowedPerTenantPerMinute,
  };
  const requests = [];
  for (let tenant = 0; tenant < 10; tenant += 1) {
    for (let request = 0; request < 10; request += 1) {
      requests.push(
        store
          .consume({ principal: principal(`tenant-${tenant}`), limits, now: 60_001 })
          .then((decision) => ({ tenant, decision })),
      );
    }
  }
  const decisions = await Promise.all(requests);
  for (let tenant = 0; tenant < 10; tenant += 1) {
    assert.equal(
      decisions.filter((item) => item.tenant === tenant && item.decision.allowed).length,
      thresholds.allowedPerTenantPerMinute,
    );
  }
  return {
    id: 'gateway-tenant-quota-fairness',
    tenants: 10,
    requests: decisions.length,
    allowedPerTenant: thresholds.allowedPerTenantPerMinute,
    state: 'pass',
  };
}

async function concurrentResearch() {
  const startedAt = performance.now();
  const orchestrator = new ResearchOrchestrator({
    adapters: ['tnl', 'docdex', 'web'].map(
      (tool) => new DeterministicEvidenceAdapter(tool, DETERMINISTIC_RESEARCH_EVIDENCE),
    ),
    codali: new DeterministicCodaliAdapter(),
    now: () => new Date('2026-07-18T12:00:00.000Z'),
  });
  const results = await Promise.all(
    Array.from({ length: 30 }, (_, index) =>
      orchestrator.run(
        { tenantId: `tenant-${index % 5}`, actorId: `actor-${index % 5}` },
        createDemoResearchTask('what_changed', `task_capacity_${String(index).padStart(3, '0')}`),
      ),
    ),
  );
  assert.ok(results.every((result) => result.citations.length > 0));
  assert.equal(new Set(results.map(({ resultId }) => resultId)).size, results.length);
  const durationMs = Math.round(performance.now() - startedAt);
  assert.ok(durationMs < thresholds.researchDurationMs);
  return {
    id: 'mixed-tenant-concurrent-research',
    tenants: 5,
    requests: results.length,
    durationMs,
    state: 'pass',
  };
}

async function webhookRuntime(tenants, endpoints, send, maximumRecords, overrides = {}) {
  const subscriptionStore = new InMemorySubscriptionStore();
  const service = new SubscriptionService({
    store: subscriptionStore,
    protector: new AesGcmSecretProtector(randomBytes(32)),
    resolver: { resolve: async () => ['8.8.8.8'] },
  });
  const subscriptions = [];
  for (let tenant = 0; tenant < tenants; tenant += 1) {
    for (let endpoint = 0; endpoint < endpoints; endpoint += 1) {
      const actor = { ownerId: `user-${tenant}`, tenantId: `tenant-${tenant}` };
      const issued = await service.create(actor, {
        endpoint: `https://hooks${endpoint}.example.com/tnl`,
        eventTypes: ['intelligence.published'],
      });
      await service.activate(actor, issued.subscription.id);
      subscriptions.push(issued.subscription.id);
    }
  }
  const deliveries = new InMemoryDeliveryStore(maximumRecords);
  const dispatcher = new WebhookDispatcher({
    subscriptions: service,
    deliveries,
    transport: { send },
    ...overrides,
  });
  return { subscriptions, deliveries, dispatcher };
}

function event(index, tenantId) {
  const id = String(index).padStart(16, '0');
  return createWebhookEvent({
    id: `evt_${id}`,
    type: 'intelligence.published',
    tenantId,
    occurredAt: '2026-07-18T12:00:00.000Z',
    publishedAt: '2026-07-18T12:00:02.000Z',
    traceId: `trace-${id}`,
    resource: {
      id: `story-${id}`,
      revision: 1,
      url: `https://theneuralledger.com/news/${id}`,
    },
    data: {
      summary: 'Synthetic capacity event.',
      categories: ['technology'],
      geographies: ['US'],
      entities: ['Example Corp'],
      assets: ['EXM'],
      impactPaths: ['supply-chain'],
      confidence: 0.9,
      language: 'en',
      provenance: ['https://example.com/source'],
    },
  });
}

function principal(tenantId) {
  return {
    id: 'principal',
    tenantId,
    subject: 'subject',
    issuer: 'https://identity.example',
    clientId: 'client',
    scopes: new Set(['tnl:read']),
    tokenIdHash: 'hash',
    authenticationMethod: 'oauth_access_token',
  };
}
