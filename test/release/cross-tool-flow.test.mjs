import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
import { renderResearchMarkdown } from '../../packages/adapters/dist/index.js';
import {
  ConnectorClient,
  MemoryConnectorDedupeStore,
  processConnectorWebhook,
} from '../../packages/connectors/dist/index.js';
import {
  InMemoryOutboxStore,
  InMemoryReplayStore,
  WebhookProducer,
  createWebhookEvent,
  signWebhook,
} from '../../packages/events/dist/index.js';
import {
  DETERMINISTIC_RESEARCH_EVIDENCE,
  DeterministicCodaliAdapter,
  DeterministicEvidenceAdapter,
  ResearchOrchestrator,
} from '../../packages/research/dist/index.js';
import pipedreamSource from '../../integrations/pipedream/sources/new-or-updated-intelligence/new-or-updated-intelligence.mjs';

const require = createRequire(import.meta.url);
const zapier = require('../../integrations/zapier');
const { processTnlWebhook } = require('../../integrations/n8n/dist/nodes/shared/runtime.js');
const timestamp = Math.floor(Date.now() / 1_000);
const publishedAt = new Date(timestamp * 1_000).toISOString();
const occurredAt = new Date((timestamp - 300) * 1_000).toISOString();

test('one committed revision survives signed delivery, all host triggers, research, and quant ingestion', async () => {
  const event = fixtureEvent();
  const outbox = new InMemoryOutboxStore();
  assert.equal(await new WebhookProducer(true).stage(outbox, event), true);
  const staged = [...outbox.records.values()][0];
  assert.equal(staged.event.id, event.id);

  const rawBody = JSON.stringify(staged.event);
  const secret = Buffer.from('release-cross-tool-secret-32-bytes!', 'utf8');
  const keyId = 'key_releaseflow123';
  const headers = signWebhook({
    event,
    rawBody,
    deliveryId: 'dlv_releaseflow12345',
    keyId,
    secret,
    timestamp,
  });
  const core = await processConnectorWebhook({
    rawBody,
    headers,
    secret,
    keyId,
    replayStore: new InMemoryReplayStore(),
    eventDedupeStore: new MemoryConnectorDedupeStore(() => timestamp * 1_000),
    now: timestamp,
  });

  const n8n = await processTnlWebhook({
    rawBody: Buffer.from(rawBody),
    headers,
    secret: secret.toString('base64url'),
    keyId,
    replayStore: claimStore(),
    eventDedupeStore: claimStore(),
    now: timestamp,
  });
  const pipedream = await runPipedream(rawBody, headers, secret, keyId);
  const zapierOutput = await zapier.triggers.new_or_updated_intelligence.operation.perform(
    {},
    {
      authData: { webhook_secret: secret.toString('base64url') },
      rawRequest: { content: rawBody, headers },
    },
  );
  assert.deepEqual(
    [core.id, n8n.id, pipedream.id, zapierOutput[0].id],
    Array(4).fill(`${event.id}:${event.resource.revision}`),
  );

  const orchestrator = new ResearchOrchestrator({
    adapters: ['tnl', 'docdex', 'web'].map(
      (tool) => new DeterministicEvidenceAdapter(tool, DETERMINISTIC_RESEARCH_EVIDENCE),
    ),
    codali: new DeterministicCodaliAdapter(),
    now: () => new Date(publishedAt),
  });
  const results = new Map();
  const client = new ConnectorClient({
    apiKey: 'release-fixture-key',
    baseUrl: 'https://api.release.example',
    now: () => new Date(publishedAt),
    fetch: async () => Response.json(story()),
    research: {
      run: async (task) => {
        const result = await orchestrator.run(
          { tenantId: event.tenantId, actorId: 'release-actor' },
          task,
        );
        results.set(result.resultId, result);
        return result;
      },
      getResult: async (resultId) => results.get(resultId),
    },
  });
  const item = await client.execute({
    operation: 'get_intelligence',
    input: { id: core.resourceId },
  });
  assert.equal(item.data.id, core.resourceId);
  assert.equal(item.data.revision, core.revision);
  const researched = await client.execute({
    operation: 'run_research',
    input: {
      workflowId: 'what-changed',
      question: `What changed for ${core.entities[0]}?`,
      from: new Date((timestamp - 7 * 86_400) * 1_000).toISOString(),
      to: event.publishedAt,
      storyIds: [core.resourceId],
      entities: core.entities,
      assets: core.assets,
    },
  });
  assert.equal(researched.data.automatedAuthor.name, 'TNL Bot');
  assert.ok(researched.data.citations.length > 0);
  const retrieved = await client.execute({
    operation: 'get_research_result',
    input: { resultId: researched.data.resultId },
  });
  assert.equal(retrieved.data.resultId, researched.data.resultId);
  const fallback = renderResearchMarkdown(retrieved.data);
  assert.match(fallback, /TNL Bot/);
  assert.match(fallback, /https:\/\//);

  const quant = quantIngest(item.data, core);
  assert.equal(quant.added, 1);
  assert.equal(quant.rows, 1);
  assert.equal(quant.intelligenceId, core.resourceId);
  assert.equal(quant.revision, core.revision);
});

async function runPipedream(rawBody, headers, secret, keyId) {
  const values = new Map([
    ['subscription', { id: 'sub_releaseflow', secret: secret.toString('base64url'), keyId }],
    ['deliveries', []],
    ['events', []],
  ]);
  const emitted = [];
  const context = {
    db: {
      get: async (key) => values.get(key),
      set: async (key, value) => values.set(key, value),
    },
    http: { respond: ({ status }) => assert.equal(status, 200) },
    $emit: (value) => emitted.push(value),
  };
  await pipedreamSource.run.call(context, { bodyRaw: rawBody, headers });
  assert.equal(emitted.length, 1);
  return emitted[0];
}

function quantIngest(item, event) {
  const input = {
    id: item.id,
    revision: item.revision,
    eventId: event.envelope.id,
    eventType: event.type,
    title: item.title,
    summary: item.summary,
    category: item.category,
    entities: item.entities,
    assets: item.assets,
    impactPaths: item.impactPaths,
    confidence: item.confidence,
    eventTime: event.occurredAt,
    tnlPublishedAt: event.publishedAt,
    tnlRevisedAt: item.updatedAt,
    retrievedAt: item.retrievedAt,
    canonicalUrl: item.canonicalUrl,
    provenance: item.citations.map(({ url }) => url),
  };
  const script = `
import json, sys, tempfile
from pathlib import Path
from tnl_intelligence.quant.lake import RevisionLake
from tnl_intelligence.quant.temporal import parse_utc
value = json.load(sys.stdin)
with tempfile.TemporaryDirectory() as root:
    lake = RevisionLake(root)
    ingest = lake.ingest([value], checkpoint='release-flow')
    snapshot = lake.snapshot(as_of=parse_utc('${new Date((timestamp + 60) * 1_000).toISOString()}'), output=Path(root) / 'snapshot')
    row = snapshot.observations[0]
    print(json.dumps({'added': ingest.added, 'rows': len(snapshot.observations), 'intelligenceId': row.intelligence_id, 'revision': row.revision}))
`;
  const result = spawnSync('.venv/bin/python', ['-c', script], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python/tnl_intelligence/src' },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function fixtureEvent() {
  return createWebhookEvent({
    id: 'evt_releaseflow123456',
    type: 'intelligence.updated',
    tenantId: 'tenant-release',
    occurredAt,
    publishedAt,
    traceId: 'trace-release-flow',
    resource: {
      id: 'story-release-flow',
      revision: 4,
      url: 'https://theneuralledger.com/news/release-flow',
    },
    data: {
      summary: 'A synthetic semiconductor supply-chain revision.',
      categories: ['technology'],
      geographies: ['US'],
      entities: ['Example Semiconductor'],
      assets: ['EXM'],
      impactPaths: ['supply-chain'],
      confidence: 0.91,
      language: 'en',
      provenance: ['https://source.example/release-flow'],
    },
  });
}

function story() {
  return {
    id: 'story-release-flow',
    slug: 'release-flow',
    title: 'Synthetic semiconductor revision',
    excerpt: 'A synthetic semiconductor supply-chain revision.',
    revision: 4,
    category: 'technology',
    date: occurredAt,
    publishedAt,
    updatedAt: publishedAt,
    impactedAssets: ['EXM'],
    passiveEntities: ['Example Semiconductor'],
    impactPaths: ['supply-chain'],
    truthPosterior: 0.91,
    sources: [{ name: 'Synthetic source', url: 'https://source.example/release-flow' }],
  };
}

function claimStore() {
  const values = new Set();
  return {
    claim(id) {
      if (values.has(id)) return false;
      values.add(id);
      return true;
    },
  };
}
