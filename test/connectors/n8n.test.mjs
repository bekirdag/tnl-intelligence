import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { createWebhookEvent, signWebhook } from '../../packages/events/dist/index.js';

const require = createRequire(import.meta.url);
const {
  createTnlSubscription,
  deleteTnlSubscription,
  executeTnlOperation,
  processTnlWebhook,
  TNL_WEBHOOK_EVENT_TYPES,
} = require('../../integrations/n8n/dist/nodes/shared/runtime.js');

describe('n8n connector behavior', () => {
  it('verifies an issued base64url key over the exact raw body and emits a stable revision ID', async () => {
    const now = 1_752_840_000;
    const event = fixture();
    const rawBody = Buffer.from(JSON.stringify(event));
    const secret = Buffer.from('n8n-fixture-webhook-secret-32bytes', 'utf8');
    const keyId = 'key_n8nfixture';
    const headers = signWebhook({
      event,
      rawBody,
      deliveryId: 'dlv_n8nfixture12345',
      keyId,
      secret,
      timestamp: now,
    });
    const deliveries = store();
    const events = store();
    const output = await processTnlWebhook({
      rawBody,
      headers,
      secret: secret.toString('base64url'),
      keyId,
      replayStore: deliveries,
      eventDedupeStore: events,
      now,
    });
    assert.equal(output.id, `${event.id}:${event.resource.revision}`);
    assert.equal(output.resourceId, event.resource.id);
    assert.deepEqual(TNL_WEBHOOK_EVENT_TYPES, [
      'intelligence.published',
      'intelligence.updated',
      'intelligence.retracted',
      'intelligence.impact_changed',
      'digest.weekly_published',
    ]);
    await assert.rejects(
      () =>
        processTnlWebhook({
          rawBody,
          headers,
          secret: secret.toString('base64url'),
          keyId,
          replayStore: deliveries,
          eventDedupeStore: events,
          now,
        }),
      /already processed/,
    );
  });

  it('executes a normalized action and completes subscription create/delete lifecycle', async () => {
    const requests = [];
    const context = {
      helpers: {
        async httpRequest(options) {
          requests.push(options);
          if (options.method === 'DELETE') return undefined;
          if (options.url.endsWith('/v1/webhooks/subscriptions')) {
            return {
              data: {
                secret: Buffer.alloc(32, 7).toString('base64url'),
                subscription: {
                  id: 'sub_n8nfixture',
                  activeKeyId: 'key_n8nfixture',
                  state: 'active',
                },
              },
            };
          }
          return {
            data: [
              {
                id: 'story-n8n',
                title: 'n8n fixture',
                revision: 2,
                publishedAt: '2026-07-18T10:00:00.000Z',
              },
            ],
            page: { next_cursor: null },
            lastSyncAt: '2026-07-18T11:00:00.000Z',
          };
        },
      },
    };
    const credentials = {
      apiKey: 'fixture-key',
      baseUrl: 'https://api.example',
      researchUrl: 'https://research.example',
      webhookUrl: 'https://hooks.example',
    };
    const output = await executeTnlOperation(context, credentials, {
      operation: 'search_intelligence',
      input: { query: 'semiconductors', pageSize: 25 },
    });
    assert.equal(output.data.count, 1);
    assert.equal(output.data.items[0].id, 'story-n8n');
    const subscription = await createTnlSubscription(context, credentials, {
      endpoint: 'https://n8n.example/webhook/tnl',
      eventTypes: ['intelligence.published'],
    });
    assert.equal(subscription.id, 'sub_n8nfixture');
    await deleteTnlSubscription(context, credentials, subscription.id);
    assert.equal(requests.at(-1).method, 'DELETE');
    assert.ok(!JSON.stringify(output).includes('fixture-key'));
  });

  it('retrieves a completed research result through the n8n runtime', async () => {
    const resultId = 'result_n8nfixture';
    const context = {
      helpers: {
        async httpRequest(options) {
          assert.equal(options.method, 'GET');
          assert.match(options.url, new RegExp(`/api/research/runs/${resultId}$`));
          return { data: { resultId, completionReason: 'complete' } };
        },
      },
    };
    const output = await executeTnlOperation(
      context,
      {
        apiKey: 'fixture-key',
        baseUrl: 'https://api.example',
        researchUrl: 'https://research.example',
        webhookUrl: 'https://hooks.example',
      },
      { operation: 'get_research_result', input: { resultId } },
    );
    assert.equal(output.data.resultId, resultId);
  });
});

function store() {
  const values = new Set();
  return {
    claim(id) {
      if (values.has(id)) return false;
      values.add(id);
      return true;
    },
  };
}

function fixture() {
  return createWebhookEvent({
    id: 'evt_n8nfixture123456',
    type: 'intelligence.updated',
    tenantId: 'tenant-fixture',
    occurredAt: '2026-07-18T08:00:00.000Z',
    publishedAt: '2026-07-18T08:01:00.000Z',
    traceId: 'trace-n8n-fixture',
    resource: {
      id: 'story-fixture',
      revision: 3,
      url: 'https://theneuralledger.com/news/fixture',
    },
    data: {
      summary: 'Connector fixture',
      categories: ['technology'],
      geographies: ['US'],
      entities: ['Example Corp'],
      assets: ['EXMPL'],
      impactPaths: ['supply-chain'],
      confidence: 0.91,
      language: 'en',
      provenance: ['https://example.com/source'],
    },
  });
}
