import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { afterEach, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StaticAccessResolver } from '../src/access.js';
import { IntrospectionTokenVerifier, StaticTokenVerifier } from '../src/auth.js';
import { MemoryAuditSink } from '../src/audit.js';
import { StaticCapabilityProvider } from '../src/capability.js';
import type {
  GatewayServerOptions,
  QuotaLimits,
  ResearchRunnerFactory,
  TokenVerifier,
} from '../src/index.js';
import { InMemoryGatewayMetrics } from '../src/metrics.js';
import { InMemoryDisableStore } from '../src/policy.js';
import { InMemoryQuotaStore } from '../src/quota.js';
import { createGatewayServer } from '../src/server.js';
import {
  DETERMINISTIC_RESEARCH_EVIDENCE,
  DeterministicCodaliAdapter,
  DeterministicEvidenceAdapter,
  ResearchOrchestrator,
} from '@theneuralledger/research';

const servers: Server[] = [];
const clients: Client[] = [];
const quota: QuotaLimits = {
  globalPerMinute: 100,
  tenantPerMinute: 100,
  principalPerMinute: 100,
  clientPerMinute: 100,
  researchPerMinute: 10,
};

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

describe('hosted MCP gateway', () => {
  it('publishes OAuth resource metadata and challenges unauthenticated requests', async () => {
    const { baseUrl } = await setup();
    const metadata = await (await fetch(`${baseUrl}/.well-known/oauth-protected-resource`)).json();
    assert.deepEqual(metadata.authorization_servers, ['https://identity.example']);
    assert.equal(metadata.resource, 'http://127.0.0.1:1/mcp');

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: mcpHeaders(),
      body: initializeBody(),
    });
    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate') ?? '', /oauth-protected-resource/);
    assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
  });

  it('completes an S256 PKCE flow through an authorization server and enforces revocation', async () => {
    const oauth = await mockAuthorizationServer();
    const tokenVerifier = new IntrospectionTokenVerifier({
      endpoint: `${oauth.issuer}/introspect`,
      clientId: 'gateway',
      clientSecret: 'gateway-secret',
      issuer: oauth.issuer,
      audience: 'pending',
      allowInsecureLoopback: true,
    });
    const { baseUrl } = await setup({ issuer: oauth.issuer, tokenVerifier });
    const resourceMetadata = await (
      await fetch(`${baseUrl}/.well-known/oauth-protected-resource`)
    ).json();
    assert.deepEqual(resourceMetadata.authorization_servers, [oauth.issuer]);
    const authorizationMetadata = await (
      await fetch(`${oauth.issuer}/.well-known/oauth-authorization-server`)
    ).json();
    assert.deepEqual(authorizationMetadata.code_challenge_methods_supported, ['S256']);
    assert.ok(authorizationMetadata.end_session_endpoint);

    const verifier = 'tnl-pkce-verifier-with-at-least-forty-three-characters-123456789';
    const state = 'state-bound-to-client-session';
    const authorization = new URL(authorizationMetadata.authorization_endpoint);
    authorization.search = new URLSearchParams({
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://client.example/callback',
      scope: 'tnl:read tnl:research',
      state,
      nonce: 'nonce-bound-to-client-session',
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: 'S256',
    }).toString();
    const authorized = await fetch(authorization, { redirect: 'manual' });
    assert.equal(authorized.status, 302);
    const callback = new URL(authorized.headers.get('location') as string);
    assert.equal(callback.origin, 'https://client.example');
    assert.equal(callback.searchParams.get('state'), state);

    const issued = await fetch(authorizationMetadata.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: callback.searchParams.get('code') as string,
        client_id: 'client-1',
        redirect_uri: 'https://client.example/callback',
        code_verifier: verifier,
      }),
    });
    assert.equal(issued.status, 200);
    const firstToken = (await issued.json()) as { access_token: string; refresh_token: string };
    assert.ok(firstToken.access_token);
    assert.ok(firstToken.refresh_token);

    const refreshed = await fetch(authorizationMetadata.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: firstToken.refresh_token,
        client_id: 'client-1',
      }),
    });
    assert.equal(refreshed.status, 200);
    const token = (await refreshed.json()) as { access_token: string; refresh_token: string };
    assert.ok(token.access_token);
    assert.ok(token.refresh_token);
    assert.notEqual(token.access_token, firstToken.access_token);
    assert.equal(
      (await rpc(baseUrl, firstToken.access_token, JSON.parse(initializeBody()))).status,
      401,
    );

    const client = new Client({ name: 'pkce-client', version: '1.0.0' });
    clients.push(client);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
        requestInit: { headers: { authorization: `Bearer ${token.access_token}` } },
      }) as unknown as Parameters<typeof client.connect>[0],
    );
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    assert.ok(tools.includes('tnl_research_what_changed'));
    const result = await client.callTool({
      name: 'tnl_research_what_changed',
      arguments: {
        question: 'What changed?',
        from: '2026-07-11T12:00:00.000Z',
        to: '2026-07-18T12:00:00.000Z',
      },
    });
    const data = result.structuredContent?.data as { automatedAuthor?: { name?: string } };
    assert.equal(data.automatedAuthor?.name, 'TNL Bot');

    const revoked = await fetch(authorizationMetadata.revocation_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: token.access_token, client_id: 'client-1' }),
    });
    assert.equal(revoked.status, 200);
    assert.equal(
      (await rpc(baseUrl, token.access_token, JSON.parse(initializeBody()))).status,
      401,
    );
  });

  it('calls TNL with only the server-side capability and exposes scoped tools', async () => {
    let upstreamAuthorization: string | undefined;
    let upstreamRequestId: string | undefined;
    const upstream = await listen(
      createServer((request, response) => {
        upstreamAuthorization = request.headers.authorization;
        upstreamRequestId = request.headers['x-request-id'] as string | undefined;
        response
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify(newsPage()));
      }),
    );
    const upstreamUrl = serverUrl(upstream);
    const audit = new MemoryAuditSink();
    const { baseUrl } = await setup({ upstreamUrl, audit });
    const client = new Client({ name: 'gateway-test', version: '1.0.0' });
    clients.push(client);
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { authorization: 'Bearer user-oauth-token' } },
    });
    await client.connect(transport as unknown as Parameters<typeof client.connect>[0]);

    assert.deepEqual(
      (await client.listTools()).tools.map((tool) => tool.name),
      [
        'tnl_latest_news',
        'tnl_search_news',
        'tnl_asset_intelligence',
        'tnl_entity_intelligence',
        'tnl_impact_path',
        'tnl_service_status',
      ],
    );
    const result = await client.callTool({ name: 'tnl_latest_news', arguments: { limit: 1 } });
    assert.deepEqual(result.structuredContent, { data: newsPage() });
    assert.equal(upstreamAuthorization, 'Bearer internal-tnl-capability');
    assert.match(upstreamRequestId ?? '', /^[0-9a-f-]{36}$/);
    const serializedAudit = JSON.stringify(audit.events);
    assert.ok(!serializedAudit.includes('user-oauth-token'));
    assert.ok(!serializedAudit.includes('internal-tnl-capability'));
    assert.ok(!serializedAudit.includes('Material event'));
  });

  it('returns a bounded tool error during a TNL outage and recovers on the same client', async () => {
    let unavailable = true;
    const upstream = await listen(
      createServer((_request, response) => {
        if (unavailable) {
          response
            .writeHead(503, { 'content-type': 'application/json' })
            .end(JSON.stringify({ error: { code: 'upstream_unavailable', message: 'offline' } }));
          return;
        }
        response
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify(newsPage()));
      }),
    );
    const { baseUrl } = await setup({ upstreamUrl: serverUrl(upstream) });
    const client = new Client({ name: 'upstream-recovery-test', version: '1.0.0' });
    clients.push(client);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
        requestInit: { headers: { authorization: 'Bearer user-oauth-token' } },
      }) as unknown as Parameters<typeof client.connect>[0],
    );
    const failed = await client.callTool({
      name: 'tnl_latest_news',
      arguments: { limit: 1 },
    });
    assert.equal(failed.isError, true);
    assert.ok(!JSON.stringify(failed).includes('internal-tnl-capability'));

    unavailable = false;
    const recovered = await client.callTool({
      name: 'tnl_latest_news',
      arguments: { limit: 1 },
    });
    assert.equal(recovered.isError, undefined);
    assert.deepEqual(recovered.structuredContent, { data: newsPage() });
  });

  it('rejects insufficient research scope and cross-tenant identity mapping', async () => {
    const { baseUrl } = await setup();
    const insufficient = await rpc(baseUrl, 'user-oauth-token', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'tnl_deep_research', arguments: { question: 'explain this event' } },
    });
    assert.equal(insufficient.status, 403);
    assert.match(insufficient.headers.get('www-authenticate') ?? '', /tnl:research/);

    const crossTenant = await rpc(baseUrl, 'cross-tenant-token', JSON.parse(initializeBody()));
    assert.equal(crossTenant.status, 403);
    assert.equal((await crossTenant.json()).error.message, 'Identity mapping is invalid');
  });

  it('publishes research tools only when the research scope is granted', async () => {
    const { baseUrl } = await setup();
    const client = new Client({ name: 'research-scope-test', version: '1.0.0' });
    clients.push(client);
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { authorization: 'Bearer research-oauth-token' } },
    });
    await client.connect(transport as unknown as Parameters<typeof client.connect>[0]);
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    assert.ok(tools.includes('tnl_explain_event'));
    assert.ok(tools.includes('tnl_deep_research'));
    assert.ok(tools.includes('tnl_research_weekly_consequential'));
    assert.equal(tools.length, 14);
    const result = await client.callTool({
      name: 'tnl_research_weekly_consequential',
      arguments: {
        question: 'What mattered this week?',
        from: '2026-07-11T00:00:00.000Z',
        to: '2026-07-18T12:00:00.000Z',
      },
    });
    const data = result.structuredContent?.data as { automatedAuthor?: { name?: string } };
    assert.equal(data.automatedAuthor?.name, 'TNL Bot');
  });

  it('does not advertise research workflows when no research runner is configured', async () => {
    const { baseUrl } = await setup({ researchEnabled: false });
    const client = new Client({ name: 'research-disabled-test', version: '1.0.0' });
    clients.push(client);
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
        requestInit: { headers: { authorization: 'Bearer research-oauth-token' } },
      }) as unknown as Parameters<typeof client.connect>[0],
    );
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    assert.equal(tools.length, 8);
    assert.ok(!tools.includes('tnl_research_weekly_consequential'));
  });

  it('rejects invalid origins, oversized input, revoked tokens, and active disables', async () => {
    const disableStore = new InMemoryDisableStore();
    disableStore.globalReason = 'incident';
    const { baseUrl } = await setup({ disableStore });
    const origin = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { ...mcpHeaders('user-oauth-token'), origin: 'https://attacker.example' },
      body: initializeBody(),
    });
    assert.equal(origin.status, 403);
    const oversized = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: mcpHeaders('user-oauth-token'),
      body: JSON.stringify({ value: 'x'.repeat(2_000) }),
    });
    assert.equal(oversized.status, 413);
    const revoked = await rpc(baseUrl, 'revoked-token', JSON.parse(initializeBody()));
    assert.equal(revoked.status, 401);
    const disabled = await rpc(baseUrl, 'user-oauth-token', JSON.parse(initializeBody()));
    assert.equal(disabled.status, 403);
  });

  it('keeps concurrent quota decisions atomic and isolated by tenant', async () => {
    const store = new InMemoryQuotaStore();
    const principal = principalFor('tenant-a');
    const limits = { ...quota, principalPerMinute: 2, tenantPerMinute: 2 };
    const decisions = await Promise.all(
      Array.from({ length: 10 }, () => store.consume({ principal, limits, now: 60_001 })),
    );
    assert.equal(decisions.filter((decision) => decision.allowed).length, 2);
    assert.ok(decisions.some((decision) => decision.reason === 'tenant_limit'));
    const other = await store.consume({ principal: principalFor('tenant-b'), limits, now: 60_001 });
    assert.equal(other.allowed, true);
  });

  it('reports liveness, readiness, and bounded metrics without dependency details', async () => {
    const { baseUrl } = await setup();
    assert.deepEqual(await (await fetch(`${baseUrl}/healthz`)).json(), {
      ok: true,
      service: 'tnl-mcp-gateway',
    });
    assert.equal((await fetch(`${baseUrl}/readyz`)).status, 200);
    await rpc(baseUrl, 'revoked-token', JSON.parse(initializeBody()));
    const metrics = await (await fetch(`${baseUrl}/metrics`)).text();
    assert.match(metrics, /tnl_gateway_requests_total/);
    assert.ok(!metrics.includes('revoked-token'));
  });

  it('fails readiness when a critical dependency probe fails', async () => {
    const { baseUrl } = await setup({ readinessChecks: [async () => false] });
    const response = await fetch(`${baseUrl}/readyz`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, service: 'tnl-mcp-gateway' });
  });
});

async function setup(
  overrides: {
    upstreamUrl?: string;
    audit?: MemoryAuditSink;
    disableStore?: InMemoryDisableStore;
    readinessChecks?: readonly (() => Promise<boolean>)[];
    researchEnabled?: boolean;
    issuer?: string;
    tokenVerifier?: TokenVerifier;
  } = {},
): Promise<{ baseUrl: string; options: GatewayServerOptions }> {
  const placeholder = 'http://127.0.0.1:1';
  const issuer = overrides.issuer ?? 'https://identity.example';
  const expiresAt = Date.now() + 60_000;
  const tokenVerifier =
    overrides.tokenVerifier ??
    new StaticTokenVerifier(
      new Map([
        [
          'user-oauth-token',
          {
            issuer,
            subject: 'user-1',
            audience: ['pending'],
            scopes: ['tnl:read'],
            clientId: 'client-1',
            expiresAt,
            tenantHint: 'tenant-1',
          },
        ],
        [
          'cross-tenant-token',
          {
            issuer,
            subject: 'user-1',
            audience: ['pending'],
            scopes: ['tnl:read'],
            clientId: 'client-1',
            expiresAt,
            tenantHint: 'tenant-2',
          },
        ],
        [
          'research-oauth-token',
          {
            issuer,
            subject: 'user-1',
            audience: ['pending'],
            scopes: ['tnl:read', 'tnl:research'],
            clientId: 'client-1',
            expiresAt,
            tenantHint: 'tenant-1',
          },
        ],
      ]),
    );
  const accessResolver = new StaticAccessResolver(
    new Map([
      [
        `${issuer}|user-1`,
        {
          principalId: 'principal-1',
          tenantId: 'tenant-1',
          status: 'active',
          plan: 'test',
          version: 'v1',
          allowedScopes: ['tnl:read', 'tnl:research'],
          quota,
        },
      ],
    ]),
  );
  const options: GatewayServerOptions = {
    publicUrl: placeholder,
    authorizationServers: [issuer],
    tokenVerifier,
    accessResolver,
    capabilityProvider: new StaticCapabilityProvider({
      accessToken: 'internal-tnl-capability',
      baseUrl: overrides.upstreamUrl ?? placeholder,
    }),
    quotaStore: new InMemoryQuotaStore(),
    disableStore: overrides.disableStore ?? new InMemoryDisableStore(),
    auditSink: overrides.audit ?? new MemoryAuditSink(),
    metrics: new InMemoryGatewayMetrics(),
    allowedOrigins: new Set(['https://client.example']),
    requireHttps: false,
    maxBodyBytes: 1_024,
    ...(overrides.readinessChecks ? { readinessChecks: overrides.readinessChecks } : {}),
    ...(overrides.researchEnabled === false
      ? {}
      : { researchRunnerFactory: fixtureResearchRunnerFactory() }),
  };
  const server = await listen(createGatewayServer(options));
  const baseUrl = serverUrl(server);
  return { baseUrl, options };
}

function fixtureResearchRunnerFactory(): ResearchRunnerFactory {
  const orchestrator = new ResearchOrchestrator({
    adapters: (['tnl', 'docdex', 'web'] as const).map(
      (tool) => new DeterministicEvidenceAdapter(tool, DETERMINISTIC_RESEARCH_EVIDENCE),
    ),
    codali: new DeterministicCodaliAdapter(),
    now: () => new Date('2026-07-18T12:00:00.000Z'),
  });
  return {
    create: (access, request) => ({
      run: (task) =>
        orchestrator.run(
          {
            tenantId: access.principal.tenantId,
            actorId: access.principal.id,
            requestId: request.requestId,
          },
          task,
        ),
    }),
    health: async () => true,
  };
}

async function rpc(baseUrl: string, token: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: mcpHeaders(token),
    body: JSON.stringify(body),
  });
}

function mcpHeaders(token?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

function initializeBody(): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'gateway-test', version: '1.0.0' },
    },
  });
}

function principalFor(tenantId: string) {
  return {
    id: 'principal-1',
    tenantId,
    subject: 'user-1',
    issuer: 'https://identity.example',
    clientId: 'client-1',
    scopes: new Set(['tnl:read']),
    tokenIdHash: 'hash',
    authenticationMethod: 'oauth_access_token' as const,
  };
}

async function listen(server: Server): Promise<Server> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  servers.push(server);
  return server;
}

function serverUrl(server: Server): string {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

async function mockAuthorizationServer(): Promise<{ issuer: string }> {
  let issuer = '';
  let codeChallenge = '';
  let codeAvailable = false;
  let refreshAvailable = false;
  const activeTokens = new Set<string>();
  const server = await listen(
    createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', issuer || 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/.well-known/oauth-authorization-server') {
        response.writeHead(200, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            introspection_endpoint: `${issuer}/introspect`,
            revocation_endpoint: `${issuer}/revoke`,
            end_session_endpoint: `${issuer}/logout`,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
          }),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/authorize') {
        assert.equal(url.searchParams.get('response_type'), 'code');
        assert.equal(url.searchParams.get('client_id'), 'client-1');
        assert.equal(url.searchParams.get('redirect_uri'), 'https://client.example/callback');
        assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
        assert.ok(url.searchParams.get('nonce'));
        codeChallenge = url.searchParams.get('code_challenge') ?? '';
        codeAvailable = true;
        const callback = new URL(url.searchParams.get('redirect_uri') as string);
        callback.searchParams.set('code', 'one-time-authorization-code');
        callback.searchParams.set('state', url.searchParams.get('state') ?? '');
        response.writeHead(302, { location: callback.toString() }).end();
        return;
      }
      if (request.method === 'POST' && url.pathname === '/token') {
        const form = new URLSearchParams(await readBody(request));
        if (form.get('grant_type') === 'refresh_token') {
          const validRefresh =
            refreshAvailable &&
            form.get('refresh_token') === 'oauth-pkce-refresh-token' &&
            form.get('client_id') === 'client-1';
          if (!validRefresh) {
            response
              .writeHead(400, { 'content-type': 'application/json' })
              .end(JSON.stringify({ error: 'invalid_grant' }));
            return;
          }
          refreshAvailable = false;
          activeTokens.delete('oauth-pkce-access-token');
          activeTokens.add('oauth-pkce-refreshed-access-token');
          response.writeHead(200, { 'content-type': 'application/json' }).end(
            JSON.stringify({
              access_token: 'oauth-pkce-refreshed-access-token',
              refresh_token: 'oauth-pkce-rotated-refresh-token',
              token_type: 'Bearer',
              expires_in: 300,
              scope: 'tnl:read tnl:research',
            }),
          );
          return;
        }
        const valid =
          codeAvailable &&
          form.get('grant_type') === 'authorization_code' &&
          form.get('code') === 'one-time-authorization-code' &&
          form.get('client_id') === 'client-1' &&
          form.get('redirect_uri') === 'https://client.example/callback' &&
          pkceChallenge(form.get('code_verifier') ?? '') === codeChallenge;
        if (!valid) {
          response
            .writeHead(400, { 'content-type': 'application/json' })
            .end(JSON.stringify({ error: 'invalid_grant' }));
          return;
        }
        codeAvailable = false;
        refreshAvailable = true;
        activeTokens.add('oauth-pkce-access-token');
        response.writeHead(200, { 'content-type': 'application/json' }).end(
          JSON.stringify({
            access_token: 'oauth-pkce-access-token',
            refresh_token: 'oauth-pkce-refresh-token',
            token_type: 'Bearer',
            expires_in: 300,
            scope: 'tnl:read tnl:research',
          }),
        );
        return;
      }
      if (request.method === 'POST' && url.pathname === '/introspect') {
        assert.equal(
          request.headers.authorization,
          `Basic ${Buffer.from('gateway:gateway-secret').toString('base64')}`,
        );
        const token = new URLSearchParams(await readBody(request)).get('token') ?? '';
        const active = activeTokens.has(token);
        response.writeHead(200, { 'content-type': 'application/json' }).end(
          JSON.stringify(
            active
              ? {
                  active: true,
                  sub: 'user-1',
                  iss: issuer,
                  aud: ['pending'],
                  exp: Math.floor(Date.now() / 1_000) + 300,
                  scope: 'tnl:read tnl:research',
                  client_id: 'client-1',
                  jti: 'pkce-token-id',
                  tenant_id: 'tenant-1',
                }
              : { active: false },
          ),
        );
        return;
      }
      if (request.method === 'POST' && url.pathname === '/revoke') {
        const token = new URLSearchParams(await readBody(request)).get('token') ?? '';
        activeTokens.delete(token);
        response.writeHead(200).end();
        return;
      }
      response.writeHead(404).end();
    }),
  );
  issuer = serverUrl(server);
  return { issuer };
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

async function readBody(request: import('node:http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function newsPage() {
  return {
    data: [{ id: 'story-1', title: 'Material event' }],
    page: {
      page: 1,
      page_size: 1,
      offset: 0,
      total_count: 1,
      total_pages: 1,
      has_more: false,
      cursor: null,
      next_cursor: null,
    },
  };
}
