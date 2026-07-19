import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { afterEach, describe, it } from 'node:test';
import {
  DETERMINISTIC_RESEARCH_EVIDENCE,
  DeterministicCodaliAdapter,
  DeterministicEvidenceAdapter,
  ResearchOrchestrator,
  createDemoResearchTask,
} from '@theneuralledger/research';
import type { AccessContext, RequestContext } from '../src/contracts.js';
import { HttpResearchRunnerFactory } from '../src/research.js';

const active: Server[] = [];
afterEach(async () => {
  await Promise.all(
    active
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.closeAllConnections() || server.close(resolve)),
      ),
  );
});

describe('gateway research runner', () => {
  it('binds internal requests to the resolved tenant and validates returned results', async () => {
    const orchestrator = new ResearchOrchestrator({
      adapters: (['tnl', 'docdex', 'web'] as const).map(
        (tool) => new DeterministicEvidenceAdapter(tool, DETERMINISTIC_RESEARCH_EVIDENCE),
      ),
      codali: new DeterministicCodaliAdapter(),
      now: () => new Date('2026-07-18T12:00:00.000Z'),
    });
    let received: Record<string, string | string[] | undefined> = {};
    const service = createServer(async (request, response) => {
      received = request.headers;
      const body = JSON.parse(await readBody(request));
      const result = await orchestrator.run(
        {
          tenantId: String(request.headers['x-tnl-tenant-id']),
          actorId: String(request.headers['x-tnl-user-id']),
        },
        body.task,
      );
      response
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ data: result }));
    });
    const url = await listen(service);
    const runner = new HttpResearchRunnerFactory({
      endpoint: url,
      serviceToken: 'internal-only-token',
      allowInsecureLoopback: true,
    }).create(access(), request());
    const result = await runner.run(createDemoResearchTask());
    assert.equal(result.automatedAuthor.name, 'TNL Bot');
    assert.equal(received['x-tnl-tenant-id'], 'tenant-bound');
    assert.equal(received['x-tnl-user-id'], 'principal-bound');
    assert.equal(received.authorization, 'Bearer internal-only-token');
  });

  it('rejects insecure non-loopback endpoints and malformed service responses', async () => {
    assert.throws(
      () => new HttpResearchRunnerFactory({ endpoint: 'http://example.com', serviceToken: 'x' }),
      /HTTPS/,
    );
    const service = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' }).end('{"data":{"bad":true}}');
    });
    const url = await listen(service);
    const runner = new HttpResearchRunnerFactory({
      endpoint: url,
      serviceToken: 'internal-only-token',
      allowInsecureLoopback: true,
    }).create(access(), request());
    await assert.rejects(() => runner.run(createDemoResearchTask()), /response is invalid/);
  });
});

function access(): AccessContext {
  return {
    principal: {
      id: 'principal-bound',
      tenantId: 'tenant-bound',
      subject: 'user',
      issuer: 'https://identity.example',
      clientId: 'client',
      scopes: new Set(['tnl:read', 'tnl:research']),
      tokenIdHash: 'hash',
      authenticationMethod: 'oauth_access_token',
    },
    entitlement: {
      status: 'active',
      plan: 'test',
      version: '1',
      allowedScopes: new Set(['tnl:read', 'tnl:research']),
      quota: {
        globalPerMinute: 10,
        tenantPerMinute: 10,
        principalPerMinute: 10,
        clientPerMinute: 10,
        researchPerMinute: 10,
      },
    },
  };
}

function request(): RequestContext {
  return {
    requestId: 'request-bound',
    startedAt: Date.now(),
    clientIpHash: 'ip',
    userAgentHash: 'agent',
  };
}

async function listen(server: Server): Promise<string> {
  active.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

async function readBody(request: import('node:http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
