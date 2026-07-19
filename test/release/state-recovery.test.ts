import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  InMemoryOutboxStore,
  WebhookProducer,
  createWebhookEvent,
  type OutboxRecord,
} from '../../packages/events/src/index.js';
import {
  InMemoryResearchResultStore,
  createDemoResearchTask,
  type ResearchResult,
} from '../../packages/research/src/index.js';

describe('repository-owned state recovery', () => {
  it('restores staged events and resumes with the original idempotency key', async () => {
    const source = new InMemoryOutboxStore();
    const event = createWebhookEvent({
      id: 'evt_recoveryfixture001',
      type: 'intelligence.published',
      tenantId: 'tenant-recovery',
      occurredAt: '2026-07-19T08:00:00.000Z',
      publishedAt: '2026-07-19T08:01:00.000Z',
      traceId: 'trace-recovery-001',
      resource: {
        id: 'story-recovery-001',
        revision: 1,
        url: 'https://theneuralledger.com/story/recovery-001',
      },
      data: {
        summary: 'Recovery fixture',
        categories: ['technology'],
        geographies: ['global'],
        entities: ['TNL'],
        assets: [],
        impactPaths: [],
        provenance: ['https://example.com/recovery-source'],
      },
    });
    const producer = new WebhookProducer(true);
    assert.equal(await producer.stage(source, event), true);

    const backup = JSON.stringify([...source.records.values()]);
    const restored = new InMemoryOutboxStore();
    for (const record of JSON.parse(backup) as OutboxRecord[])
      assert.equal(await restored.appendUnique(record), true);

    assert.equal(await producer.stage(restored, event), false);
    const [leased] = await restored.lease(
      'recovery-worker',
      Date.parse(event.publishedAt),
      5_000,
      1,
    );
    assert.equal(leased?.event.id, event.id);
    await restored.markQueued(leased!.id, 'recovery-worker', Date.parse(event.publishedAt) + 1);
    assert.equal(restored.records.get(leased!.id)?.state, 'queued');
  });

  it('restores retained research results without crossing tenant boundaries', async () => {
    const task = createDemoResearchTask();
    const result: ResearchResult = {
      schemaVersion: '1.0',
      resultId: 'res_recovery_fixture',
      taskId: task.taskId,
      taskType: task.taskType,
      skill: { id: 'weekly-consequential', version: '1.0.0' },
      directAnswer: 'Recovered result',
      executiveSummary: 'Recovered from a portable backup record.',
      claims: [],
      evidence: [],
      contradictions: [],
      unknowns: [],
      assumptions: [],
      timeline: [],
      impactPaths: [],
      citations: [],
      trace: [],
      graders: [],
      budget: {
        limit: task.budget,
        used: {
          toolCalls: 0,
          durationMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          sources: 0,
          costUsd: 0,
        },
      },
      completionReason: 'complete',
      warnings: [],
      asOf: task.asOf,
      lastCheckedAt: task.asOf,
      automatedAuthor: {
        name: 'TNL Bot',
        profileUrl: 'https://theneuralledger.com/about/tnl-bot',
      },
      orchestration: { provider: 'recovery-test', version: '1.0.0' },
    };
    const source = new InMemoryResearchResultStore();
    await source.save('tenant-recovery', 'owner-recovery', result);
    const backup = JSON.stringify(await source.get('tenant-recovery', result.resultId));

    const restored = new InMemoryResearchResultStore();
    await restored.save('tenant-recovery', 'owner-recovery', JSON.parse(backup) as ResearchResult);
    assert.deepEqual(await restored.get('tenant-recovery', result.resultId), result);
    assert.equal(await restored.get('other-tenant', result.resultId), undefined);
  });
});
