import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DETERMINISTIC_RESEARCH_EVIDENCE,
  DeterministicCodaliAdapter,
  DeterministicEvidenceAdapter,
  ResearchOrchestrator,
  createDemoResearchTask,
} from '@theneuralledger/research';
import {
  ADAPTER_WORKFLOWS,
  buildResearchTask,
  createTelemetryEvent,
  negotiateCapabilities,
  normalizeAdapterError,
  renderResearchMarkdown,
  selectAdapterProfile,
} from '../src/index.js';

describe('shared AI client adapter contracts', () => {
  it('maps every Tool 05 workflow to a unique research tool and validated task', () => {
    assert.equal(ADAPTER_WORKFLOWS.length, 6);
    assert.equal(new Set(ADAPTER_WORKFLOWS.map((item) => item.toolName)).size, 6);
    const result = buildResearchTask(
      {
        workflowId: 'weekly-consequential',
        question: 'What mattered this week?',
        requestId: 'request-123',
      },
      new Date('2026-07-18T12:00:00.000Z'),
    );
    assert.equal(result.timeWindowSource, 'default-seven-days');
    assert.deepEqual(result.task.timeWindow, {
      from: '2026-07-11T12:00:00.000Z',
      to: '2026-07-18T12:00:00.000Z',
    });
    assert.equal(result.task.sourcePolicy.minimumIndependentSources, 3);
    assert.equal(result.task.taskId, 'task_request-123');
  });

  it('requires one explicit connection profile and rejects configuration conflicts', () => {
    assert.equal(
      selectAdapterProfile({ localConfigured: true, remoteConfigured: false }).mode,
      'local',
    );
    assert.equal(
      selectAdapterProfile({
        localConfigured: true,
        remoteConfigured: true,
        preferred: 'remote',
      }).mode,
      'remote',
    );
    assert.throws(
      () => selectAdapterProfile({ localConfigured: true, remoteConfigured: true }),
      /choose local or remote/,
    );
    assert.throws(
      () => selectAdapterProfile({ localConfigured: false, remoteConfigured: false }),
      /Configure a local or remote/,
    );
  });

  it('negotiates the full research surface and degrades when the rich UI is absent', () => {
    const complete = negotiateCapabilities({
      protocolVersion: '2025-11-25',
      gatewayVersion: '0.1.0',
      researchSchemaVersion: '1.0',
      tools: ADAPTER_WORKFLOWS.map((item) => item.toolName),
      resources: ['ui://tnl/research-workspace'],
    });
    assert.deepEqual(complete, {
      compatible: true,
      missingTools: [],
      reasons: [],
      richResearchUi: true,
    });
    const partial = negotiateCapabilities({
      protocolVersion: '2025-11-25',
      gatewayVersion: '0.0.9',
      researchSchemaVersion: '1.0',
      tools: [],
    });
    assert.equal(partial.compatible, false);
    assert.equal(partial.missingTools.length, 6);
    assert.equal(partial.richResearchUi, false);
  });

  it('renders cited, classified, time-aware Markdown without unsafe links', async () => {
    const orchestrator = new ResearchOrchestrator({
      adapters: (['tnl', 'docdex', 'web'] as const).map(
        (tool) => new DeterministicEvidenceAdapter(tool, DETERMINISTIC_RESEARCH_EVIDENCE),
      ),
      codali: new DeterministicCodaliAdapter(),
      now: () => new Date('2026-07-18T12:00:00.000Z'),
    });
    const result = await orchestrator.run(
      { tenantId: 'tenant-a', actorId: 'actor-a' },
      createDemoResearchTask(),
    );
    result.citations.push({
      evidenceId: 'ev-unsafe',
      label: '[unsafe]',
      url: 'javascript:alert(1)',
    });
    const markdown = renderResearchMarkdown(result);
    assert.match(markdown, /Automated by \[TNL Bot\]/);
    assert.match(markdown, /\*\*Fact \(/);
    assert.match(markdown, /As of 2026-07-18/);
    assert.ok(!markdown.includes('javascript:'));
    assert.match(markdown, /not investment advice/);
  });

  it('normalizes recovery guidance without retaining error or credential content', () => {
    const auth = normalizeAdapterError({ status: 401, token: 'top-secret' });
    assert.deepEqual(auth, {
      code: 'authentication_required',
      message: 'TNL authorization is required.',
      recovery: 'Sign in again.',
      retryable: false,
    });
    assert.ok(!JSON.stringify(auth).includes('top-secret'));
    assert.equal(normalizeAdapterError({ status: 429 }).retryable, true);
  });

  it('limits telemetry to typed metadata and hashed correlation IDs', () => {
    const event = createTelemetryEvent({
      name: 'workflow_completed',
      host: 'cursor',
      adapterVersion: '0.1.0',
      workflowId: 'what-changed',
      outcome: 'success',
      durationMs: 50,
      requestIdHash: 'a'.repeat(32),
    });
    assert.equal(event.schemaVersion, '1.0');
    assert.deepEqual(Object.keys(event).sort(), [
      'adapterVersion',
      'durationMs',
      'host',
      'name',
      'outcome',
      'requestIdHash',
      'schemaVersion',
      'workflowId',
    ]);
    assert.throws(
      () =>
        createTelemetryEvent({
          name: 'workflow_failed',
          host: 'openai',
          adapterVersion: '0.1.0',
          requestIdHash: 'raw-request-id',
        }),
      /one-way hexadecimal hash/,
    );
  });
});
