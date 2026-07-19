import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createWebhookEvent, signWebhook } from '../../packages/events/dist/index.js';
import {
  DETERMINISTIC_RESEARCH_EVIDENCE,
  DeterministicCodaliAdapter,
  DeterministicEvidenceAdapter,
  ResearchOrchestrator,
  createDemoResearchTask,
} from '../../packages/research/dist/index.js';
import getResearchResult from '../../integrations/pipedream/actions/get-research-result/get-research-result.mjs';
import source from '../../integrations/pipedream/sources/new-or-updated-intelligence/new-or-updated-intelligence.mjs';

describe('Pipedream connector behavior', () => {
  it('uses bodyRaw, persistent dedupe state, and stable emit metadata', async () => {
    const event = fixture();
    const rawBody = JSON.stringify(event);
    const secret = Buffer.from('pipedream-webhook-secret-32-bytes!', 'utf8');
    const timestamp = Math.floor(Date.now() / 1_000);
    const headers = signWebhook({
      event,
      rawBody,
      deliveryId: 'dlv_pipedream123456',
      keyId: 'key_pipedream123',
      secret,
      timestamp,
    });
    const context = runtime({
      subscription: {
        id: 'sub_pipedream',
        secret: secret.toString('base64url'),
        keyId: 'key_pipedream123',
      },
      deliveries: [],
      events: [],
    });
    await source.run.call(context, { bodyRaw: rawBody, headers });
    assert.deepEqual(context.responses, [{ status: 200, body: { accepted: true } }]);
    assert.equal(context.emitted[0]?.value.id, `${event.id}:${event.resource.revision}`);
    assert.equal(context.emitted[0]?.metadata.id, `${event.id}:${event.resource.revision}`);
    await source.run.call(context, { bodyRaw: rawBody, headers });
    assert.deepEqual(context.responses.at(-1), {
      status: 200,
      body: { accepted: true, duplicate: true },
    });
    assert.equal(context.emitted.length, 1);
  });

  it('creates and removes its remote subscription during source lifecycle hooks', async () => {
    const calls = [];
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return Response.json({
        data: {
          secret: Buffer.alloc(32, 9).toString('base64url'),
          subscription: {
            id: 'sub_pipedreamfixture',
            activeKeyId: 'key_pipedreamfixture',
            state: 'active',
          },
        },
      });
    };
    try {
      const context = runtime({});
      Object.assign(context, {
        tnl: {
          connection: () => ({
            apiKey: 'fixture-key',
            baseUrl: 'https://api.example',
            researchUrl: 'https://research.example',
            webhookUrl: 'https://hooks.example',
          }),
        },
        eventTypes: ['intelligence.published'],
        categories: ['technology'],
        minimumConfidence: 0.8,
      });
      context.http.endpoint = 'https://endpoint.m.pipedream.net/fixture';
      await source.hooks.deploy.call(context);
      assert.equal((await context.db.get('subscription')).id, 'sub_pipedreamfixture');
      await source.hooks.deactivate.call(context);
      assert.equal(await context.db.get('subscription'), undefined);
      assert.equal(calls.at(-1).init.method, 'DELETE');
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it('retrieves and validates a completed research result through the action runtime', async () => {
    const now = new Date('2026-07-18T12:00:00.000Z');
    const orchestrator = new ResearchOrchestrator({
      adapters: ['tnl', 'docdex', 'web'].map(
        (tool) => new DeterministicEvidenceAdapter(tool, DETERMINISTIC_RESEARCH_EVIDENCE),
      ),
      codali: new DeterministicCodaliAdapter(),
      now: () => now,
    });
    const expected = await orchestrator.run(
      { tenantId: 'tenant-a', actorId: 'actor-a' },
      createDemoResearchTask('what_changed', 'task_pipedream_result'),
    );
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      assert.equal(init?.method, 'GET');
      assert.match(String(input), new RegExp(`/api/research/runs/${expected.resultId}$`));
      return Response.json({ data: expected });
    };
    try {
      const summaries = [];
      const output = await getResearchResult.run.call(
        {
          tnl: {
            connection: () => ({
              apiKey: 'fixture-key',
              baseUrl: 'https://api.example',
              researchUrl: 'https://research.example',
              webhookUrl: 'https://hooks.example',
            }),
          },
          resultId: expected.resultId,
        },
        { $: { export: (...args) => summaries.push(args) } },
      );
      assert.equal(output.resultId, expected.resultId);
      assert.ok(output.citations.length > 0);
      assert.equal(summaries.length, 1);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});

function runtime(initial) {
  const values = new Map(Object.entries(initial));
  const context = {
    db: {
      get: async (key) => values.get(key),
      set: async (key, value) => values.set(key, value),
    },
    responses: [],
    emitted: [],
    http: {
      respond(response) {
        context.responses.push(response);
      },
    },
    $emit(value, metadata) {
      context.emitted.push({ value, metadata });
    },
  };
  return context;
}

function fixture() {
  return createWebhookEvent({
    id: 'evt_pipedream1234567',
    type: 'intelligence.published',
    tenantId: 'tenant-fixture',
    occurredAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    traceId: 'trace-pipedream-fixture',
    resource: {
      id: 'story-pipedream',
      revision: 1,
      url: 'https://theneuralledger.com/news/pipedream',
    },
    data: {
      summary: 'Pipedream connector fixture',
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
