import assert from 'node:assert/strict';
import { type Server } from 'node:http';
import { afterEach, describe, it } from 'node:test';
import {
  CredentialService,
  InMemoryCredentialStore,
  MemoryCredentialAuditSink,
} from '../src/credentials.js';
import { HeaderSessionAuthenticator } from '../src/identity.js';
import { createOnboardingServer } from '../src/server.js';
import { InMemoryUsageStore } from '../src/usage.js';

const servers: Server[] = [];

afterEach(async () => {
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

describe('developer onboarding service', () => {
  it('serves versioned static sample data without a key or production fallback', async () => {
    const baseUrl = await setup();
    const response = await fetch(`${baseUrl}/v1/sample/news?q=semiconductor&page_size=1`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-tnl-data-mode'), 'static-sample');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    const body = await response.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].author, 'TNL Bot');
    assert.equal(body.sample.staticOnly, true);
    assert.equal(body.sample.license, 'CC0-1.0');
    assert.ok(body.data[0].sources.length > 0);

    const empty = await (await fetch(`${baseUrl}/v1/search?q=no-such-sample-story`)).json();
    assert.deepEqual(empty.data, []);
    const missing = await fetch(`${baseUrl}/v1/news/no-such-id`);
    assert.equal(missing.status, 404);
  });

  it('serves the canonical contract, explorer, and public-safe Postman assets', async () => {
    const baseUrl = await setup();
    const contract = await (await fetch(`${baseUrl}/openapi.json`)).json();
    assert.ok(contract.paths['/v1/sample/news']);
    assert.deepEqual(contract.paths['/v1/sample/news'].get.security, []);
    const html = await (await fetch(baseUrl)).text();
    assert.match(html, /TNL Developer Console/);
    assert.match(
      (await fetch(`${baseUrl}/styles.css`)).headers.get('content-security-policy') ?? '',
      /default-src/,
    );
    const app = await (await fetch(`${baseUrl}/app.js`)).text();
    assert.doesNotMatch(app, /localStorage|sessionStorage|indexedDB/);
    const environment = await (await fetch(`${baseUrl}/postman/environment.json`)).text();
    assert.match(environment, /"tnl_api_key"/);
    assert.doesNotMatch(environment, /tnl_(live|prod)_[A-Za-z0-9_-]+/);
  });

  it('completes create, list, authenticate, rotate, revoke, usage, and account deletion', async () => {
    const baseUrl = await setup();
    const created = await developer(baseUrl, '/developer/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Browser agent', scopes: ['news:read'], lifetimeDays: 30 }),
    });
    assert.equal(created.status, 201);
    const issued = (await created.json()).data;
    assert.match(issued.secret, /^tnl_dev_/);

    const list = await (await developer(baseUrl, '/developer/api/keys')).json();
    assert.equal(list.data.length, 1);
    assert.ok(!JSON.stringify(list).includes(issued.secret));
    assert.ok(!JSON.stringify(list).includes('verifier'));

    const authenticated = await developer(baseUrl, '/developer/api/authenticate', {
      method: 'POST',
      body: JSON.stringify({ apiKey: issued.secret }),
    });
    assert.equal(authenticated.status, 200);
    const usage = await (await developer(baseUrl, '/developer/api/usage')).json();
    assert.equal(usage.data.requestCount, 1);
    assert.ok(usage.data.checkpoints.api_first_success);

    const rotated = await developer(baseUrl, `/developer/api/keys/${issued.credential.id}/rotate`, {
      method: 'POST',
    });
    assert.equal(rotated.status, 200);
    const replacement = (await rotated.json()).data;
    assert.notEqual(replacement.secret, issued.secret);
    const revoked = await developer(
      baseUrl,
      `/developer/api/keys/${replacement.credential.id}/revoke`,
      { method: 'POST' },
    );
    assert.equal(revoked.status, 200);
    assert.equal((await revoked.json()).data.status, 'revoked');

    const deletion = await developer(baseUrl, '/developer/api/account', { method: 'DELETE' });
    assert.equal(deletion.status, 204);
    assert.deepEqual((await (await developer(baseUrl, '/developer/api/keys')).json()).data, []);
  });

  it('rejects missing sessions, stale destructive auth, cross-tenant access, and arbitrary telemetry', async () => {
    const baseUrl = await setup();
    assert.equal((await fetch(`${baseUrl}/developer/api/keys`)).status, 401);
    const created = await developer(baseUrl, '/developer/api/keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Isolation', scopes: ['news:read'] }),
    });
    const id = (await created.json()).data.credential.id;
    const stale = await fetch(`${baseUrl}/developer/api/keys/${id}/revoke`, {
      method: 'POST',
      headers: developerHeaders({ recent: '1' }),
    });
    assert.equal(stale.status, 403);
    const crossTenant = await fetch(`${baseUrl}/developer/api/keys/${id}/revoke`, {
      method: 'POST',
      headers: developerHeaders({ tenant: 'tenant-2' }),
    });
    assert.equal(crossTenant.status, 404);
    const telemetry = await developer(baseUrl, '/developer/api/checkpoints', {
      method: 'POST',
      body: JSON.stringify({ event: 'raw_prompt_with_story_body' }),
    });
    assert.equal(telemetry.status, 400);
  });

  it('enforces the public sample limit with truthful reset and retry headers', async () => {
    const baseUrl = await setup({ publicSamplePerMinute: 2 });
    const first = await fetch(`${baseUrl}/v1/sample/news`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('x-ratelimit-limit'), '2');
    assert.equal(first.headers.get('x-ratelimit-remaining'), '1');
    const second = await fetch(`${baseUrl}/v1/sample/news`);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get('x-ratelimit-remaining'), '0');
    const rejected = await fetch(`${baseUrl}/v1/sample/news`);
    assert.equal(rejected.status, 429);
    assert.equal(rejected.headers.get('x-ratelimit-remaining'), '0');
    assert.ok(Number(rejected.headers.get('x-ratelimit-reset')) > 0);
    assert.ok(Number(rejected.headers.get('retry-after')) > 0);
    assert.equal((await rejected.json()).error.code, 'sample_rate_exhausted');
  });
});

async function setup(options: { publicSamplePerMinute?: number } = {}): Promise<string> {
  const server = createOnboardingServer({
    credentials: new CredentialService({
      store: new InMemoryCredentialStore(),
      audit: new MemoryCredentialAuditSink(),
    }),
    identity: new HeaderSessionAuthenticator(),
    usage: new InMemoryUsageStore(10),
    ...options,
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  servers.push(server);
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

function developer(baseUrl: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...developerHeaders(), ...(init.headers ?? {}) },
  });
}

function developerHeaders(
  values: { tenant?: string; recent?: string } = {},
): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-tnl-user': 'user-1',
    'x-tnl-tenant': values.tenant ?? 'tenant-1',
    'x-tnl-recent-auth': values.recent ?? String(Date.now()),
  };
}
