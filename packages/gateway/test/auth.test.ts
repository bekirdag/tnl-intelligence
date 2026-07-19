import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IntrospectionTokenVerifier } from '../src/auth.js';
import { configFromEnvironment } from '../src/config.js';
import { GatewayError } from '../src/errors.js';

describe('OAuth introspection verifier', () => {
  it('validates issuer, audience, time, client, and scopes without returning the raw token', async () => {
    let request: Request | undefined;
    const verifier = new IntrospectionTokenVerifier({
      endpoint: 'http://127.0.0.1/oauth/introspect',
      clientId: 'gateway-client',
      clientSecret: 'introspection-secret',
      issuer: 'https://identity.example',
      audience: 'https://mcp.example/mcp',
      allowInsecureLoopback: true,
      fetch: async (input, init) => {
        request = new Request(input, init);
        return Response.json({
          active: true,
          sub: 'user-1',
          iss: 'https://identity.example',
          aud: ['https://mcp.example/mcp'],
          exp: 2_000,
          nbf: 900,
          scope: 'tnl:read tnl:research',
          client_id: 'client-1',
          jti: 'token-id',
          tenant_id: 'tenant-1',
        });
      },
    });
    const result = await verifier.verify('external-oauth-token', 1_000_000);
    assert.equal(result.subject, 'user-1');
    assert.deepEqual([...result.scopes], ['tnl:read', 'tnl:research']);
    assert.equal(result.tenantHint, 'tenant-1');
    assert.notEqual(result.tokenIdHash, 'external-oauth-token');
    assert.equal(
      request?.headers.get('authorization'),
      `Basic ${btoa('gateway-client:introspection-secret')}`,
    );
    assert.equal(await request?.text(), 'token=external-oauth-token&token_type_hint=access_token');
  });

  it('rejects inactive, expired, future, wrong-issuer, and wrong-audience tokens', async () => {
    const base = {
      active: true,
      sub: 'user-1',
      iss: 'https://identity.example',
      aud: 'https://mcp.example/mcp',
      exp: 2_000,
      scope: 'tnl:read',
      client_id: 'client-1',
    };
    const invalid = [
      { ...base, active: false },
      { ...base, exp: 999 },
      { ...base, nbf: 1_001 },
      { ...base, iss: 'https://attacker.example' },
      { ...base, aud: 'https://other.example/mcp' },
    ];
    for (const payload of invalid) {
      const verifier = verifierFor(payload);
      await assert.rejects(
        verifier.verify('sensitive-token', 1_000_000),
        (error: unknown) =>
          error instanceof GatewayError &&
          error.code === 'invalid_token' &&
          !error.message.includes('sensitive-token'),
      );
    }
  });

  it('maps IdP outages to a secret-free dependency error', async () => {
    const verifier = verifierFor(undefined, async () => {
      throw new Error('network down for raw-token-value');
    });
    await assert.rejects(
      verifier.verify('raw-token-value'),
      (error: unknown) =>
        error instanceof GatewayError &&
        error.code === 'dependency_unavailable' &&
        !error.message.includes('raw-token-value'),
    );
  });
});

describe('gateway environment configuration', () => {
  it('requires explicit development credentials', () => {
    assert.throws(() => configFromEnvironment({ TNL_GATEWAY_MODE: 'development' }), /DEV_BEARER/);
    const config = configFromEnvironment({
      TNL_GATEWAY_MODE: 'development',
      TNL_GATEWAY_DEV_BEARER_TOKEN: 'dev-user-token',
      TNL_GATEWAY_UPSTREAM_API_KEY: 'dev-upstream-key',
    });
    assert.equal(config.host, '127.0.0.1');
    assert.equal(config.server.requireHttps, false);
  });

  it('rejects insecure production endpoints and never selects static adapters', () => {
    const env = productionEnvironment();
    env.TNL_GATEWAY_INTROSPECTION_URL = 'http://identity.example/oauth/introspect';
    assert.throws(() => configFromEnvironment(env), /OAuth endpoints must use HTTPS/);

    const config = configFromEnvironment(productionEnvironment());
    assert.equal(config.host, '0.0.0.0');
    assert.equal(config.server.requireHttps, true);
    assert.equal(config.server.readinessChecks?.length, 2);
    assert.equal(config.server.tokenVerifier.constructor.name, 'IntrospectionTokenVerifier');
    assert.equal(config.server.capabilityProvider.constructor.name, 'HttpCapabilityProvider');
  });

  it('requires a dedicated token and HTTPS when the research service is configured', () => {
    const missingToken = productionEnvironment();
    missingToken.TNL_GATEWAY_RESEARCH_URL = 'https://research.internal.example';
    assert.throws(() => configFromEnvironment(missingToken), /RESEARCH_SERVICE_TOKEN/);

    const insecure = productionEnvironment();
    insecure.TNL_GATEWAY_RESEARCH_URL = 'http://research.internal.example';
    insecure.TNL_GATEWAY_RESEARCH_SERVICE_TOKEN = 'research-workload-token';
    assert.throws(() => configFromEnvironment(insecure), /must use HTTPS/);

    const configured = productionEnvironment();
    configured.TNL_GATEWAY_RESEARCH_URL = 'https://research.internal.example';
    configured.TNL_GATEWAY_RESEARCH_SERVICE_TOKEN = 'research-workload-token';
    assert.equal(
      configFromEnvironment(configured).server.researchRunnerFactory?.constructor.name,
      'HttpResearchRunnerFactory',
    );
  });
});

function verifierFor(
  payload: Record<string, unknown> | undefined,
  fetchImplementation?: typeof globalThis.fetch,
): IntrospectionTokenVerifier {
  return new IntrospectionTokenVerifier({
    endpoint: 'http://127.0.0.1/oauth/introspect',
    clientId: 'gateway-client',
    clientSecret: 'secret',
    issuer: 'https://identity.example',
    audience: 'https://mcp.example/mcp',
    allowInsecureLoopback: true,
    fetch: fetchImplementation ?? (async () => Response.json(payload)),
  });
}

function productionEnvironment(): NodeJS.ProcessEnv {
  return {
    TNL_GATEWAY_MODE: 'production',
    TNL_GATEWAY_PUBLIC_URL: 'https://mcp.example',
    TNL_GATEWAY_AUTHORIZATION_SERVERS: 'https://identity.example',
    TNL_GATEWAY_ISSUER: 'https://identity.example',
    TNL_GATEWAY_INTROSPECTION_URL: 'https://identity.example/oauth/introspect',
    TNL_GATEWAY_INTROSPECTION_CLIENT_ID: 'gateway-client',
    TNL_GATEWAY_INTROSPECTION_CLIENT_SECRET: 'introspection-secret',
    TNL_GATEWAY_ACCESS_URL: 'https://control.example/access',
    TNL_GATEWAY_CAPABILITY_URL: 'https://control.example/capability',
    TNL_GATEWAY_QUOTA_URL: 'https://control.example/quota',
    TNL_GATEWAY_DISABLE_URL: 'https://control.example/disable',
    TNL_GATEWAY_AUDIT_URL: 'https://control.example/audit',
    TNL_GATEWAY_SERVICE_TOKEN: 'workload-token',
    TNL_GATEWAY_IDP_HEALTH_URL: 'https://identity.example/healthz',
    TNL_GATEWAY_CONTROL_HEALTH_URL: 'https://control.example/healthz',
  };
}
