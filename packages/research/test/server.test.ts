import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { Server } from 'node:http';
import {
  DETERMINISTIC_RESEARCH_EVIDENCE,
  DeterministicCodaliAdapter,
  DeterministicEvidenceAdapter,
  ResearchOrchestrator,
  createDemoResearchTask,
  createResearchHttpServer,
  listenResearchHttp,
} from '../src/index.js';

const active: Server[] = [];
afterEach(async () =>
  Promise.all(
    active.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  ),
);

describe('research HTTP service', () => {
  it('requires identity and isolates saved results across tenants', async () => {
    const server = createResearchHttpServer({
      orchestrator: fixtureOrchestrator(),
      authorize: async (request) => {
        const tenant = request.headers['x-tnl-tenant-id'];
        const actor = request.headers['x-tnl-user-id'];
        if (typeof tenant !== 'string' || typeof actor !== 'string') return undefined;
        return {
          tenantId: tenant,
          actorId: actor,
          scopes: new Set(['research:run', 'research:read', 'research:delete']),
        };
      },
    });
    active.push(server);
    const address = await listenResearchHttp(server, { port: 0 });
    const base = `http://${address.host}:${address.port}`;
    assert.equal((await fetch(`${base}/api/skills`)).status, 401);
    const headers = {
      'content-type': 'application/json',
      'x-tnl-tenant-id': 'tenant-a',
      'x-tnl-user-id': 'owner-a',
    };
    const runResponse = await fetch(`${base}/api/research/runs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ task: createDemoResearchTask('what_changed', 'task_http') }),
    });
    assert.equal(runResponse.status, 200);
    const result = (await runResponse.json()).data;
    assert.equal(result.automatedAuthor.name, 'TNL Bot');
    assert.equal(
      (await fetch(`${base}/api/research/runs/${result.resultId}`, { headers })).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${base}/api/research/runs/${result.resultId}`, {
          headers: { ...headers, 'x-tnl-tenant-id': 'tenant-b' },
        })
      ).status,
      404,
    );
    const markdown = await fetch(
      `${base}/api/research/runs/${result.resultId}/export?format=markdown`,
      { headers },
    );
    assert.equal(markdown.status, 200);
    assert.match(await markdown.text(), /Automated by TNL Bot/);
    assert.equal(
      (await fetch(`${base}/api/research/runs/${result.resultId}`, { method: 'DELETE', headers }))
        .status,
      200,
    );
  });

  it('serves health, metrics, app assets, and bounded bodies', async () => {
    const server = createResearchHttpServer({
      orchestrator: fixtureOrchestrator(),
      authorize: async (request) =>
        request.headers['x-tnl-tenant-id']
          ? {
              tenantId: 'tenant-a',
              actorId: 'actor-a',
              scopes: new Set(['research:run', 'research:read', 'research:delete']),
            }
          : undefined,
      maxBodyBytes: 64,
    });
    active.push(server);
    const address = await listenResearchHttp(server, { port: 0 });
    const base = `http://${address.host}:${address.port}`;
    assert.deepEqual(await fetch(`${base}/healthz`).then((response) => response.json()), {
      ok: true,
    });
    assert.match(await fetch(`${base}/`).then((response) => response.text()), /Research workspace/);
    assert.equal((await fetch(`${base}/assets/tnl-bot.png`)).status, 200);
    assert.match(
      await fetch(`${base}/metrics`).then((response) => response.text()),
      /tnl_research_requests_total/,
    );
    const oversized = await fetch(`${base}/api/research/runs`, {
      method: 'POST',
      headers: { 'x-tnl-tenant-id': 'tenant-a' },
      body: 'x'.repeat(100),
    });
    assert.equal(oversized.status, 413);
  });
});

function fixtureOrchestrator() {
  return new ResearchOrchestrator({
    adapters: (['tnl', 'docdex', 'web'] as const).map(
      (tool) => new DeterministicEvidenceAdapter(tool, DETERMINISTIC_RESEARCH_EVIDENCE),
    ),
    codali: new DeterministicCodaliAdapter(),
    now: () => new Date('2026-07-18T12:00:00.000Z'),
  });
}
