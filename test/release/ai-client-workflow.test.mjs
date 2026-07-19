import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildResearchTask,
  normalizeAdapterError,
  partialResultFailure,
  renderResearchMarkdown,
} from '../../packages/adapters/dist/index.js';
import {
  DETERMINISTIC_RESEARCH_EVIDENCE,
  DeterministicCodaliAdapter,
  DeterministicEvidenceAdapter,
  DisabledCodaliAdapter,
  ResearchOrchestrator,
} from '../../packages/research/dist/index.js';

const now = new Date('2026-07-18T12:00:00.000Z');
const context = { tenantId: 'tenant-ai-client', actorId: 'actor-ai-client' };

describe('AI client research workflows', () => {
  for (const workflow of [
    {
      id: 'what-changed',
      taskType: 'what_changed',
      question: 'What materially changed in the selected period?',
    },
    {
      id: 'validate-event',
      taskType: 'event_validation',
      question: 'Is the reported semiconductor controls event corroborated?',
    },
  ]) {
    it(`runs ${workflow.id} from task construction through cited fallback rendering`, async () => {
      const built = buildResearchTask(
        {
          workflowId: workflow.id,
          question: workflow.question,
          from: '2026-07-11T12:00:00.000Z',
          to: now.toISOString(),
          requestId: `client-${workflow.id}`,
        },
        now,
      );
      const result = await completeOrchestrator().run(context, built.task);
      const markdown = renderResearchMarkdown(result);

      assert.equal(built.task.taskType, workflow.taskType);
      assert.equal(result.completionReason, 'complete');
      assert.ok(result.citations.length >= 2);
      assert.ok(result.claims.every((claim) => claim.supportingEvidenceIds.length > 0));
      assert.equal(result.automatedAuthor.name, 'TNL Bot');
      assert.match(markdown, /## Sources/);
      assert.match(markdown, /Automated by \[TNL Bot\]/);
      assert.match(markdown, /As of 2026-07-18/);
    });
  }

  it('renders usable partial evidence and normalizes retry and sign-in recovery', async () => {
    const built = buildResearchTask(
      {
        workflowId: 'what-changed',
        question: 'What changed despite degraded synthesis?',
        from: '2026-07-11T12:00:00.000Z',
        to: now.toISOString(),
      },
      now,
    );
    const partial = await partialOrchestrator().run(context, built.task);
    const markdown = renderResearchMarkdown(partial);

    assert.equal(partial.completionReason, 'partial');
    assert.ok(partial.citations.length >= 2);
    assert.match(markdown, /## Sources/);
    assert.match(markdown, /Codali was unavailable/);
    assert.equal(partialResultFailure().code, 'partial_result');

    const rateLimit = normalizeAdapterError({ status: 429 });
    assert.deepEqual(
      { code: rateLimit.code, retryable: rateLimit.retryable },
      { code: 'rate_limited', retryable: true },
    );
    const authentication = normalizeAdapterError({ status: 401, token: 'must-not-leak' });
    assert.deepEqual(
      { code: authentication.code, recovery: authentication.recovery },
      { code: 'authentication_required', recovery: 'Sign in again.' },
    );
    assert.ok(!JSON.stringify(authentication).includes('must-not-leak'));
  });
});

function completeOrchestrator() {
  return new ResearchOrchestrator({
    adapters: evidenceAdapters(),
    codali: new DeterministicCodaliAdapter(),
    now: () => now,
  });
}

function partialOrchestrator() {
  return new ResearchOrchestrator({
    adapters: evidenceAdapters(),
    codali: new DisabledCodaliAdapter(),
    now: () => now,
  });
}

function evidenceAdapters() {
  return ['tnl', 'docdex', 'web'].map(
    (tool) => new DeterministicEvidenceAdapter(tool, DETERMINISTIC_RESEARCH_EVIDENCE),
  );
}
