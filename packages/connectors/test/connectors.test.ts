import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InMemoryReplayStore, createWebhookEvent, signWebhook } from '@theneuralledger/events';
import {
  DETERMINISTIC_RESEARCH_EVIDENCE,
  DeterministicCodaliAdapter,
  DeterministicEvidenceAdapter,
  ResearchOrchestrator,
} from '@theneuralledger/research';
import {
  CONNECTOR_OPERATIONS,
  ConnectorClient,
  HttpConnectorSubscriptionClient,
  MemoryConnectorDedupeStore,
  advancePollingState,
  processConnectorWebhook,
} from '../src/index.js';

const now = new Date('2026-07-18T12:00:00.000Z');

describe('automation connector core', () => {
  it('normalizes seven shared operations with explicit cursors and temporal fields', async () => {
    const requests: string[] = [];
    const client = new ConnectorClient({
      apiKey: 'fixture-key',
      baseUrl: 'https://api.example',
      now: () => now,
      fetch: async (input) => {
        requests.push(String(input));
        return Response.json(page());
      },
    });
    assert.equal(CONNECTOR_OPERATIONS.length, 7);
    const output = await client.execute({
      operation: 'search_intelligence',
      input: {
        query: 'semiconductors',
        from: '2026-07-11T00:00:00Z',
        pageSize: 20,
        cursor: 'cursor-1',
      },
    });
    assert.equal(output.operation, 'search_intelligence');
    if (output.operation !== 'search_intelligence') return;
    assert.equal(output.data.items[0]?.id, 'story-1');
    assert.equal(output.data.items[0]?.revision, 2);
    assert.equal(output.data.items[0]?.canonicalUrl, 'https://theneuralledger.com/news/sample');
    assert.equal(output.data.nextCursor, 'cursor-2');
    assert.equal(output.data.asOf, '2026-07-18T11:00:00.000Z');
    assert.match(requests[0] ?? '', /cursor=cursor-1/);
    assert.match(requests[0] ?? '', /published_since=2026-07-11T00%3A00%3A00.000Z/);
  });

  it('runs Tool 05 research without copying orchestration into a host adapter', async () => {
    const orchestrator = fixtureOrchestrator();
    let storedResult;
    const client = new ConnectorClient({
      apiKey: 'fixture-key',
      baseUrl: 'https://api.example',
      now: () => now,
      fetch: async () => Response.json(page()),
      research: {
        run: async (task) => {
          storedResult = await orchestrator.run({ tenantId: 'tenant-a', actorId: 'actor-a' }, task);
          return storedResult;
        },
        getResult: async (resultId) =>
          storedResult?.resultId === resultId ? storedResult : undefined,
      },
    });
    const output = await client.execute({
      operation: 'run_research',
      input: {
        workflowId: 'what-changed',
        question: 'What changed?',
        from: '2026-07-11T00:00:00Z',
        to: '2026-07-18T12:00:00Z',
      },
    });
    assert.equal(output.operation, 'run_research');
    if (output.operation !== 'run_research') return;
    assert.equal(output.data.automatedAuthor.name, 'TNL Bot');
    assert.equal(output.data.asOf, '2026-07-18T12:00:00.000Z');
    assert.ok(output.data.citations.length > 0);
    const retrieved = await client.execute({
      operation: 'get_research_result',
      input: { resultId: output.data.resultId },
    });
    assert.equal(retrieved.operation, 'get_research_result');
    assert.equal(retrieved.data.resultId, output.data.resultId);
  });

  it('verifies exact webhook bytes before parsing and deduplicates delivery and revision', async () => {
    const event = eventFixture();
    const rawBody = JSON.stringify(event);
    const secret = 's'.repeat(32);
    const headers = signWebhook({
      event,
      rawBody,
      deliveryId: 'dlv_abcdefghijklmnop',
      keyId: 'key_abcdefghijk',
      secret,
      timestamp: 1_752_840_000,
    });
    const replay = new InMemoryReplayStore();
    const events = new MemoryConnectorDedupeStore(() => 1_752_840_000_000);
    const result = await processConnectorWebhook({
      rawBody,
      headers,
      secret,
      keyId: 'key_abcdefghijk',
      replayStore: replay,
      eventDedupeStore: events,
      now: 1_752_840_000,
    });
    assert.equal(result.id, `${event.id}:2`);
    assert.equal(result.resourceId, 'story-1');
    await assert.rejects(
      () =>
        processConnectorWebhook({
          rawBody,
          headers,
          secret,
          keyId: 'key_abcdefghijk',
          replayStore: replay,
          eventDedupeStore: events,
          now: 1_752_840_000,
        }),
      (error: unknown) => (error as { code?: string }).code === 'duplicate_event',
    );
    await assert.rejects(
      () =>
        processConnectorWebhook({
          rawBody: `${rawBody} `,
          headers,
          secret,
          keyId: 'key_abcdefghijk',
          now: 1_752_840_000,
        }),
      (error: unknown) => (error as { code?: string }).code === 'invalid_webhook',
    );
  });

  it('decodes the base64url secret returned by the webhook subscription API', async () => {
    const event = eventFixture();
    const rawBody = JSON.stringify(event);
    const secret = Buffer.from('issued-subscription-secret-key-32!', 'utf8');
    const issued = secret.toString('base64url');
    const headers = signWebhook({
      event,
      rawBody,
      deliveryId: 'dlv_issuedsecret1234',
      keyId: 'key_issuedsecret',
      secret,
      timestamp: 1_752_840_000,
    });
    const result = await processConnectorWebhook({
      rawBody,
      headers,
      secret: issued,
      keyId: 'key_issuedsecret',
      now: 1_752_840_000,
    });
    assert.equal(result.id, `${event.id}:2`);
  });

  it('creates and removes webhook subscriptions without exposing credentials', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new HttpConnectorSubscriptionClient({
      baseUrl: 'https://hooks.example',
      credential: 'host-managed-secret',
      fetch: async (input, init) => {
        calls.push({ url: String(input), init });
        if (init?.method === 'DELETE') return new Response(null, { status: 204 });
        return Response.json(
          {
            data: {
              secret: 'w'.repeat(43),
              subscription: {
                id: 'sub_fixture123',
                activeKeyId: 'key_fixture123',
                state: 'active',
              },
            },
          },
          { status: 201 },
        );
      },
    });
    const subscription = await client.create({
      endpoint: 'https://workflow.example/tnl',
      eventTypes: ['intelligence.published'],
      filters: { categories: ['technology', 'technology'], minimumConfidence: 0.7 },
    });
    assert.equal(subscription.id, 'sub_fixture123');
    await client.remove(subscription.id);
    assert.equal(calls.length, 2);
    assert.ok(!JSON.stringify(subscription).includes('host-managed-secret'));
    assert.match(
      String((calls[0]?.init?.headers as Record<string, string>).authorization),
      /host-managed-secret/,
    );
  });

  it('does not backfill by default and preserves updates across polling restarts', () => {
    const first = advancePollingState({ events: [eventFixture()], nextCursor: 'next-1' });
    assert.deepEqual(first.emitted, []);
    const duplicate = advancePollingState({
      state: first.state,
      events: [eventFixture()],
      nextCursor: 'next-2',
    });
    assert.deepEqual(duplicate.emitted, []);
    const revised = eventFixture(3, 'evt_abcdefghijklmnop3');
    const update = advancePollingState({
      state: duplicate.state,
      events: [revised],
      nextCursor: null,
    });
    assert.deepEqual(
      update.emitted.map((event) => event.id),
      [revised.id],
    );
  });
});

function fixtureOrchestrator() {
  return new ResearchOrchestrator({
    adapters: (['tnl', 'docdex', 'web'] as const).map(
      (tool) => new DeterministicEvidenceAdapter(tool, DETERMINISTIC_RESEARCH_EVIDENCE),
    ),
    codali: new DeterministicCodaliAdapter(),
    now: () => now,
  });
}

function page() {
  return {
    data: [
      {
        id: 'story-1',
        slug: 'sample',
        title: 'Sample intelligence',
        excerpt: 'Fixture summary',
        revision: 2,
        category: 'technology',
        publishedAt: '2026-07-17T10:00:00Z',
        updatedAt: '2026-07-18T10:00:00Z',
        impactedAssets: ['NVDA'],
        passiveEntities: ['Example Corp'],
        impactPaths: ['supply-chain'],
        truthPosterior: 0.91,
        sources: [{ name: 'Fixture source', url: 'https://source.example/report' }],
      },
    ],
    page: {
      page: 1,
      page_size: 1,
      offset: 0,
      total_count: 2,
      total_pages: 2,
      has_more: true,
      cursor: 'cursor-1',
      next_cursor: 'cursor-2',
    },
    lastSyncAt: '2026-07-18T11:00:00Z',
  };
}

function eventFixture(revision = 2, id = 'evt_abcdefghijklmnop2') {
  return createWebhookEvent({
    id,
    type: 'intelligence.updated',
    tenantId: 'tenant-a',
    occurredAt: '2026-07-18T08:00:00Z',
    publishedAt: '2026-07-18T08:01:00Z',
    traceId: 'trace-fixture-123',
    resource: {
      id: 'story-1',
      revision,
      url: 'https://theneuralledger.com/news/sample',
    },
    data: {
      summary: 'Fixture summary',
      categories: ['technology'],
      geographies: ['US'],
      entities: ['Example Corp'],
      assets: ['NVDA'],
      impactPaths: ['supply-chain'],
      confidence: 0.91,
      language: 'en',
      provenance: ['https://source.example/report'],
    },
  });
}
