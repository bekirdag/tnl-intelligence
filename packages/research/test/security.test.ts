import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HttpCodaliAdapter,
  HttpEvidenceAdapter,
  InMemoryResearchResultStore,
  createDemoResearchTask,
} from '../src/index.js';

describe('research security boundaries', () => {
  it('requires HTTPS and rejects credentials embedded in service URLs', () => {
    assert.throws(
      () => new HttpEvidenceAdapter('web', { endpoint: 'http://example.com/search' }),
      /HTTPS/,
    );
    assert.throws(
      () => new HttpCodaliAdapter({ endpoint: 'https://user:secret@example.com/run' }),
      /credentials/,
    );
    assert.doesNotThrow(
      () =>
        new HttpEvidenceAdapter('docdex', {
          endpoint: 'http://127.0.0.1:28491/search',
          allowLoopbackHttp: true,
        }),
    );
  });

  it('enforces owner deletion and tenant read isolation', async () => {
    const store = new InMemoryResearchResultStore();
    const task = createDemoResearchTask();
    const result = {
      schemaVersion: '1.0' as const,
      resultId: 'res_security_fixture',
      taskId: task.taskId,
      taskType: task.taskType,
      skill: { id: 'weekly-consequential', version: '1.0.0' },
      directAnswer: '',
      executiveSummary: '',
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
      completionReason: 'partial' as const,
      warnings: [],
      asOf: task.asOf,
      lastCheckedAt: task.asOf,
      automatedAuthor: {
        name: 'TNL Bot' as const,
        profileUrl: 'https://theneuralledger.com/about/tnl-bot' as const,
      },
      orchestration: { provider: 'test', version: '1' },
    };
    await store.save('tenant-a', 'owner-a', result);
    assert.equal(await store.get('tenant-b', result.resultId), undefined);
    assert.equal(await store.delete('tenant-a', 'owner-b', result.resultId), false);
    assert.equal(await store.delete('tenant-a', 'owner-a', result.resultId), true);
  });
});
