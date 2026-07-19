import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { createWebhookEvent, signWebhook } from '../../packages/events/dist/index.js';

const require = createRequire(import.meta.url);
const App = require('../../integrations/zapier');

describe('Zapier connector behavior', () => {
  it('normalizes a search action through z.request', async () => {
    const requests = [];
    const z = zapier(requests, page());
    const output = await App.creates.search_intelligence.operation.perform(z, {
      authData: { api_key: 'fixture-key' },
      inputData: { query: 'semiconductors', page_size: '25' },
    });
    assert.equal(output.count, 1);
    assert.equal(output.items[0].id, 'story-zapier');
    assert.equal(requests[0].params.q, 'semiconductors');
    assert.equal(requests[0].headers.authorization, 'Bearer fixture-key');
  });

  it('subscribes with a pre-shared secret, verifies raw content, and unsubscribes', async () => {
    const secret = Buffer.from('zapier-webhook-secret-key-32-bytes', 'utf8');
    const issued = secret.toString('base64url');
    const requests = [];
    const z = zapier(requests, {
      data: {
        secret: issued,
        subscription: { id: 'sub_zapierfixture', activeKeyId: 'key_zapierfixture' },
      },
    });
    const operation = App.triggers.new_or_updated_intelligence.operation;
    const bundle = {
      authData: { api_key: 'fixture-key', webhook_secret: issued },
      inputData: {
        event_types: ['intelligence.published'],
        minimum_confidence: 0.7,
      },
      targetUrl: 'https://hooks.zapier.com/hooks/catch/fixture',
    };
    const subscribed = await operation.performSubscribe(z, bundle);
    assert.equal(subscribed.id, 'sub_zapierfixture');
    assert.equal(requests[0].body.secret, issued);

    const event = fixture();
    const rawBody = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1_000);
    const headers = signWebhook({
      event,
      rawBody,
      deliveryId: 'dlv_zapierfixture12',
      keyId: 'key_zapierfixture',
      secret,
      timestamp,
    });
    const emitted = await operation.perform(z, {
      authData: bundle.authData,
      rawRequest: { content: rawBody, headers },
    });
    assert.equal(emitted[0].id, `${event.id}:${event.resource.revision}`);

    await operation.performUnsubscribe(z, {
      authData: bundle.authData,
      subscribeData: subscribed,
    });
    assert.equal(requests.at(-1).method, 'DELETE');
  });

  it('executes recent-change and research-result actions and exposes a weekly trigger', async () => {
    const requests = [];
    const z = zapier(requests, page());
    const changes = await App.creates.list_recent_changes.operation.perform(z, {
      authData: { api_key: 'fixture-key' },
      inputData: { since: '2026-07-17T00:00:00.000Z', page_size: 25 },
    });
    assert.equal(changes.items[0].id, 'story-zapier');
    assert.equal(requests[0].params.updated_since, '2026-07-17T00:00:00.000Z');

    const resultId = 'result_zapierfixture';
    const result = await App.creates.get_research_result.operation.perform(
      zapier(requests, { data: { resultId, completionReason: 'complete' } }),
      {
        authData: { api_key: 'fixture-key' },
        inputData: { result_ref: resultId },
      },
    );
    assert.equal(result.resultId, resultId);
    assert.equal(App.triggers.weekly_edition.operation.sample.type, 'digest.weekly_published');
  });
});

function zapier(requests, responseData) {
  return {
    request: async (options) => {
      requests.push(options);
      return {
        status: options.method === 'DELETE' ? 204 : 200,
        data: options.method === 'DELETE' ? undefined : responseData,
        throwForStatus() {},
      };
    },
  };
}

function page() {
  return {
    data: [
      {
        id: 'story-zapier',
        slug: 'zapier',
        title: 'Zapier fixture',
        revision: 2,
        publishedAt: '2026-07-18T10:00:00.000Z',
      },
    ],
    page: { next_cursor: null },
    lastSyncAt: '2026-07-18T11:00:00.000Z',
  };
}

function fixture() {
  return createWebhookEvent({
    id: 'evt_zapierfixture1234',
    type: 'intelligence.published',
    tenantId: 'tenant-fixture',
    occurredAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    traceId: 'trace-zapier-fixture',
    resource: {
      id: 'story-zapier',
      revision: 1,
      url: 'https://theneuralledger.com/news/zapier',
    },
    data: {
      summary: 'Zapier connector fixture',
      categories: ['technology'],
      geographies: ['US'],
      entities: ['Example Corp'],
      assets: ['EXMPL'],
      impactPaths: ['supply-chain'],
      confidence: 0.9,
      language: 'en',
      provenance: ['https://example.com/source'],
    },
  });
}
