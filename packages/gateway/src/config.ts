import { HttpAccessResolver, StaticAccessResolver } from './access.js';
import { IntrospectionTokenVerifier, StaticTokenVerifier } from './auth.js';
import { HttpAuditSink, JsonAuditSink } from './audit.js';
import { HttpCapabilityProvider, StaticCapabilityProvider } from './capability.js';
import type { GatewayServerOptions } from './server.js';
import { InMemoryGatewayMetrics } from './metrics.js';
import { HttpDisableStore, InMemoryDisableStore } from './policy.js';
import { HttpQuotaStore, InMemoryQuotaStore } from './quota.js';
import { HttpResearchRunnerFactory } from './research.js';

export interface GatewayRuntimeConfig {
  host: string;
  port: number;
  server: GatewayServerOptions;
}

export function configFromEnvironment(env: NodeJS.ProcessEnv = process.env): GatewayRuntimeConfig {
  const mode =
    env.TNL_GATEWAY_MODE ?? (env.NODE_ENV === 'production' ? 'production' : 'development');
  if (!['production', 'development', 'test'].includes(mode)) {
    throw new TypeError('TNL_GATEWAY_MODE must be production, development, or test');
  }
  const production = mode === 'production';
  const publicUrl =
    env.TNL_GATEWAY_PUBLIC_URL ??
    (production ? required(env, 'TNL_GATEWAY_PUBLIC_URL') : 'http://127.0.0.1:7318');
  const authorizationServers = csv(
    env.TNL_GATEWAY_AUTHORIZATION_SERVERS ??
      (production ? required(env, 'TNL_GATEWAY_AUTHORIZATION_SERVERS') : 'http://127.0.0.1:7319'),
  );
  const serviceToken = production ? required(env, 'TNL_GATEWAY_SERVICE_TOKEN') : '';
  const metrics = new InMemoryGatewayMetrics();

  if (production) {
    assertHttps('TNL_GATEWAY_PUBLIC_URL', publicUrl);
    authorizationServers.forEach((value) =>
      assertHttps('TNL_GATEWAY_AUTHORIZATION_SERVERS', value),
    );
    const audience = env.TNL_GATEWAY_AUDIENCE ?? new URL('/mcp', publicUrl).toString();
    const researchEndpoint = env.TNL_GATEWAY_RESEARCH_URL?.trim();
    const server: GatewayServerOptions = {
      publicUrl,
      authorizationServers,
      tokenVerifier: new IntrospectionTokenVerifier({
        endpoint: required(env, 'TNL_GATEWAY_INTROSPECTION_URL'),
        clientId: required(env, 'TNL_GATEWAY_INTROSPECTION_CLIENT_ID'),
        clientSecret: required(env, 'TNL_GATEWAY_INTROSPECTION_CLIENT_SECRET'),
        issuer: required(env, 'TNL_GATEWAY_ISSUER'),
        audience,
      }),
      accessResolver: new HttpAccessResolver({
        endpoint: required(env, 'TNL_GATEWAY_ACCESS_URL'),
        serviceToken,
      }),
      capabilityProvider: new HttpCapabilityProvider({
        endpoint: required(env, 'TNL_GATEWAY_CAPABILITY_URL'),
        serviceToken,
        audience: 'tnl-api',
      }),
      quotaStore: new HttpQuotaStore({
        endpoint: required(env, 'TNL_GATEWAY_QUOTA_URL'),
        serviceToken,
      }),
      disableStore: new HttpDisableStore({
        endpoint: required(env, 'TNL_GATEWAY_DISABLE_URL'),
        serviceToken,
      }),
      auditSink: new HttpAuditSink({
        endpoint: required(env, 'TNL_GATEWAY_AUDIT_URL'),
        serviceToken,
      }),
      metrics,
      allowedOrigins: new Set(csv(env.TNL_GATEWAY_ALLOWED_ORIGINS ?? '')),
      requireHttps: true,
      maxBodyBytes: integer(env, 'TNL_GATEWAY_MAX_BODY_BYTES', 131_072, 1_024, 1_048_576),
      requestTimeoutMs: integer(env, 'TNL_GATEWAY_REQUEST_TIMEOUT_MS', 35_000, 1_000, 120_000),
      maxConcurrency: integer(env, 'TNL_GATEWAY_MAX_CONCURRENCY', 100, 1, 10_000),
      readinessChecks: [
        readinessCheck(required(env, 'TNL_GATEWAY_IDP_HEALTH_URL')),
        readinessCheck(required(env, 'TNL_GATEWAY_CONTROL_HEALTH_URL'), serviceToken),
      ],
      ...(researchEndpoint
        ? {
            researchRunnerFactory: new HttpResearchRunnerFactory({
              endpoint: researchEndpoint,
              serviceToken: required(env, 'TNL_GATEWAY_RESEARCH_SERVICE_TOKEN'),
              timeoutMs: integer(env, 'TNL_GATEWAY_RESEARCH_TIMEOUT_MS', 45_000, 1_000, 120_000),
            }),
          }
        : {}),
    };
    return {
      host: env.TNL_GATEWAY_HOST ?? '0.0.0.0',
      port: integer(env, 'TNL_GATEWAY_PORT', 7318, 1, 65_535),
      server,
    };
  }

  const token = required(env, 'TNL_GATEWAY_DEV_BEARER_TOKEN');
  const upstreamKey = required(env, 'TNL_GATEWAY_UPSTREAM_API_KEY');
  const issuer = authorizationServers[0] ?? 'http://127.0.0.1:7319';
  const audience = new URL('/mcp', publicUrl).toString();
  const quota = {
    globalPerMinute: 1_000,
    tenantPerMinute: 500,
    principalPerMinute: 100,
    clientPerMinute: 100,
    researchPerMinute: 10,
  };
  const server: GatewayServerOptions = {
    publicUrl,
    authorizationServers,
    tokenVerifier: new StaticTokenVerifier(
      new Map([
        [
          token,
          {
            issuer,
            subject: env.TNL_GATEWAY_DEV_SUBJECT ?? 'local-user',
            audience: [audience],
            scopes: csv(env.TNL_GATEWAY_DEV_SCOPES ?? 'tnl:read,tnl:research'),
            clientId: env.TNL_GATEWAY_DEV_CLIENT_ID ?? 'local-client',
            expiresAt: Date.now() + 24 * 60 * 60 * 1_000,
            tenantHint: env.TNL_GATEWAY_DEV_TENANT ?? 'local-tenant',
          },
        ],
      ]),
    ),
    accessResolver: new StaticAccessResolver(
      new Map([
        [
          `${issuer}|${env.TNL_GATEWAY_DEV_SUBJECT ?? 'local-user'}`,
          {
            principalId: env.TNL_GATEWAY_DEV_PRINCIPAL ?? 'local-principal',
            tenantId: env.TNL_GATEWAY_DEV_TENANT ?? 'local-tenant',
            status: 'active',
            plan: 'development',
            version: 'dev-1',
            allowedScopes: ['tnl:read', 'tnl:research'],
            quota,
          },
        ],
      ]),
    ),
    capabilityProvider: new StaticCapabilityProvider({
      accessToken: upstreamKey,
      baseUrl: env.TNL_BASE_URL ?? 'https://theneuralledger.com',
    }),
    quotaStore: new InMemoryQuotaStore(),
    disableStore: new InMemoryDisableStore(),
    auditSink: new JsonAuditSink((line) => process.stderr.write(`${line}\n`)),
    metrics,
    allowedOrigins: new Set(csv(env.TNL_GATEWAY_ALLOWED_ORIGINS ?? '')),
    requireHttps: false,
    ...(env.TNL_GATEWAY_RESEARCH_URL
      ? {
          researchRunnerFactory: new HttpResearchRunnerFactory({
            endpoint: env.TNL_GATEWAY_RESEARCH_URL,
            serviceToken: required(env, 'TNL_GATEWAY_RESEARCH_SERVICE_TOKEN'),
            timeoutMs: integer(env, 'TNL_GATEWAY_RESEARCH_TIMEOUT_MS', 45_000, 1_000, 120_000),
            allowInsecureLoopback: true,
          }),
        }
      : {}),
  };
  return {
    host: env.TNL_GATEWAY_HOST ?? '127.0.0.1',
    port: integer(env, 'TNL_GATEWAY_PORT', 7318, 1, 65_535),
    server,
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new TypeError(`${name} is required`);
  return value;
}

function csv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function integer(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function assertHttps(name: string, value: string): void {
  if (new URL(value).protocol !== 'https:') throw new TypeError(`${name} must use HTTPS`);
}

function readinessCheck(url: string, bearerToken?: string): () => Promise<boolean> {
  assertHttps('readiness URL', url);
  return async () => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: bearerToken ? { authorization: `Bearer ${bearerToken}` } : {},
        signal: AbortSignal.timeout(2_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  };
}
