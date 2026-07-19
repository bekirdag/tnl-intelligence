import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createTnlMcpServer, type TnlToolName } from '@theneuralledger/mcp';
import { TnlClient } from '@theneuralledger/sdk';
import { sha256 } from './crypto.js';
import type {
  AccessContext,
  AccessResolver,
  AuditEvent,
  AuditSink,
  CapabilityProvider,
  DisableStore,
  GatewayMetrics,
  QuotaStore,
  RequestContext,
  TokenVerifier,
} from './contracts.js';
import { GatewayError } from './errors.js';
import { authorize, BASE_SCOPE, POLICY_VERSION } from './policy.js';
import type { ResearchRunnerFactory } from './research.js';

export interface GatewayServerOptions {
  publicUrl: string;
  authorizationServers: readonly string[];
  tokenVerifier: TokenVerifier;
  accessResolver: AccessResolver;
  capabilityProvider: CapabilityProvider;
  quotaStore: QuotaStore;
  disableStore: DisableStore;
  auditSink: AuditSink;
  metrics: GatewayMetrics;
  allowedOrigins?: ReadonlySet<string>;
  requireHttps?: boolean;
  maxBodyBytes?: number;
  requestTimeoutMs?: number;
  capabilityLifetimeMs?: number;
  maxConcurrency?: number;
  now?: () => number;
  readinessChecks?: readonly (() => Promise<boolean>)[];
  researchRunnerFactory?: ResearchRunnerFactory;
}

export function createGatewayServer(options: GatewayServerOptions): Server {
  const publicUrl = canonicalUrl(options.publicUrl);
  const metadataUrl = new URL('/.well-known/oauth-protected-resource', publicUrl).toString();
  const limiter = new ConcurrencyLimiter(options.maxConcurrency ?? 100);
  const now = options.now ?? Date.now;
  const server = createServer(
    { maxHeaderSize: 16 * 1_024, requestTimeout: options.requestTimeoutMs ?? 35_000 },
    async (request, response) => {
      const context = requestContext(request, now());
      response.setHeader('x-request-id', context.requestId);
      response.setHeader('x-content-type-options', 'nosniff');
      response.setHeader('cache-control', 'no-store');
      try {
        if (request.method === 'GET' && isMetadataPath(request.url)) {
          json(response, 200, {
            resource: new URL('/mcp', publicUrl).toString(),
            authorization_servers: options.authorizationServers,
            scopes_supported: [BASE_SCOPE, 'tnl:research'],
            bearer_methods_supported: ['header'],
          });
          return;
        }
        if (request.url === '/healthz' && request.method === 'GET') {
          json(response, 200, { ok: true, service: 'tnl-mcp-gateway' });
          return;
        }
        if (request.url === '/readyz' && request.method === 'GET') {
          const ready = await dependenciesHealthy(options);
          json(response, ready ? 200 : 503, { ok: ready, service: 'tnl-mcp-gateway' });
          return;
        }
        if (request.url === '/metrics' && request.method === 'GET') {
          response
            .writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' })
            .end(options.metrics.render());
          return;
        }
        if (request.url !== '/mcp') {
          json(response, 404, { error: 'not_found', request_id: context.requestId });
          return;
        }
        await limiter.run(async () =>
          handleMcp(request, response, context, metadataUrl, options, now),
        );
      } catch (error) {
        await handleFailure(error, response, context, metadataUrl, options);
      }
    },
  );
  server.headersTimeout = Math.min(options.requestTimeoutMs ?? 35_000, 15_000);
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 1_000;
  return server;
}

async function handleMcp(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
  metadataUrl: string,
  options: GatewayServerOptions,
  now: () => number,
): Promise<void> {
  if (request.method !== 'POST') {
    throw new GatewayError('invalid_request', 'Method not allowed', 405);
  }
  enforceHttps(request, options.requireHttps ?? true);
  enforceOrigin(request, options.allowedOrigins ?? new Set());
  enforceMediaTypes(request);
  const externalToken = bearerToken(request);
  if (!externalToken)
    throw new GatewayError('invalid_token', 'Bearer access token is required', 401);
  const body = await readJson(request, options.maxBodyBytes ?? 128 * 1_024);
  const toolName = requestedTool(body);
  const verified = await options.tokenVerifier.verify(externalToken, now());
  const access = await options.accessResolver.resolve(verified);
  const policy = await authorize(access, options.disableStore, toolName);
  const quota = await options.quotaStore.consume({
    principal: access.principal,
    ...(policy.tool ? { tool: policy.tool } : {}),
    limits: access.entitlement.quota,
    now: now(),
  });
  response.setHeader('x-ratelimit-remaining', String(quota.remaining));
  response.setHeader('x-ratelimit-reset', String(Math.ceil(quota.resetAt / 1_000)));
  if (!quota.allowed) {
    throw new GatewayError('quota_exhausted', 'Request quota is exhausted', 429, {
      retryAfterSeconds: quota.retryAfterSeconds,
    });
  }
  const capability = await options.capabilityProvider.issue({
    principal: access.principal,
    tools: policy.allowedTools,
    requestId: context.requestId,
    expiresAt: Math.min(verified.expiresAt, now() + (options.capabilityLifetimeMs ?? 60_000)),
  });
  if (capability.expiresAt <= now()) {
    throw new GatewayError('dependency_unavailable', 'Upstream capability is expired', 503);
  }
  const client = new TnlClient({
    apiKey: capability.accessToken,
    baseUrl: capability.baseUrl,
    timeoutMs: Math.min(options.requestTimeoutMs ?? 30_000, capability.expiresAt - now()),
    retries: 1,
    userAgent: '@theneuralledger/gateway/0.1.0',
    requestId: context.requestId,
  });
  const mcp = createTnlMcpServer({
    client,
    allowedTools: policy.allowedTools,
    ...(options.researchRunnerFactory
      ? { research: options.researchRunnerFactory.create(access, context) }
      : {}),
  });
  const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
  response.on('close', () => {
    void transport.close();
    void mcp.close();
  });
  await emitAudit(
    options.auditSink,
    event('tool_call', 'allowed', 'policy_allowed', context, access, policy.tool),
  );
  options.metrics.increment('tnl_gateway_requests_total', {
    outcome: 'allowed',
    ...(policy.tool ? { tool: policy.tool } : {}),
  });
  await mcp.connect(transport as unknown as Parameters<typeof mcp.connect>[0]);
  await transport.handleRequest(request, response, body);
  options.metrics.observe('tnl_gateway_request_duration_ms', Date.now() - context.startedAt, {
    outcome: response.statusCode >= 400 ? 'error' : 'success',
  });
  await emitAudit(
    options.auditSink,
    event(
      'request_completed',
      response.statusCode >= 400 ? 'error' : 'allowed',
      `http_${response.statusCode}`,
      context,
      access,
      policy.tool,
    ),
  );
}

async function handleFailure(
  error: unknown,
  response: ServerResponse,
  context: RequestContext,
  metadataUrl: string,
  options: GatewayServerOptions,
): Promise<void> {
  const gatewayError =
    error instanceof GatewayError
      ? error
      : new GatewayError('dependency_unavailable', 'Gateway request failed', 500, { cause: error });
  const type =
    gatewayError.code === 'invalid_token'
      ? 'authentication_denied'
      : gatewayError.code === 'quota_exhausted'
        ? 'quota_denied'
        : gatewayError.code === 'dependency_unavailable'
          ? 'dependency_failure'
          : 'policy_denied';
  options.metrics.increment('tnl_gateway_requests_total', {
    outcome: 'denied',
    reason: gatewayError.code,
  });
  await emitAudit(
    options.auditSink,
    event(type, gatewayError.status >= 500 ? 'error' : 'denied', gatewayError.code, context),
  );
  if (response.headersSent) {
    response.destroy();
    return;
  }
  if (gatewayError.status === 401 || gatewayError.status === 403) {
    response.setHeader(
      'www-authenticate',
      challenge(metadataUrl, gatewayError.requiredScope, gatewayError.status === 403),
    );
  }
  if (gatewayError.retryAfterSeconds !== undefined) {
    response.setHeader('retry-after', String(gatewayError.retryAfterSeconds));
  }
  json(response, gatewayError.status, {
    jsonrpc: '2.0',
    error: { code: rpcCode(gatewayError.status), message: gatewayError.message },
    id: null,
    request_id: context.requestId,
  });
}

function event(
  type: AuditEvent['type'],
  outcome: AuditEvent['outcome'],
  reason: string,
  context: RequestContext,
  access?: AccessContext,
  tool?: TnlToolName,
): AuditEvent {
  return {
    timestamp: new Date().toISOString(),
    type,
    requestId: context.requestId,
    outcome,
    reason,
    durationMs: Date.now() - context.startedAt,
    ...(access
      ? {
          principalIdHash: sha256(access.principal.id),
          tenantIdHash: sha256(access.principal.tenantId),
          clientIdHash: sha256(access.principal.clientId),
          policyVersion: POLICY_VERSION,
        }
      : {}),
    ...(tool ? { tool } : {}),
  };
}

async function emitAudit(sink: AuditSink, value: AuditEvent): Promise<void> {
  await sink.emit(value);
}

async function dependenciesHealthy(options: GatewayServerOptions): Promise<boolean> {
  const checks: Array<() => Promise<boolean>> = [
    () => options.tokenVerifier.health?.() ?? Promise.resolve(true),
    () => options.accessResolver.health?.() ?? Promise.resolve(true),
    () => options.capabilityProvider.health?.() ?? Promise.resolve(true),
    () => options.quotaStore.health?.() ?? Promise.resolve(true),
    () => options.disableStore.health?.() ?? Promise.resolve(true),
    () => options.auditSink.health?.() ?? Promise.resolve(true),
    () => options.researchRunnerFactory?.health?.() ?? Promise.resolve(true),
    ...(options.readinessChecks ?? []),
  ];
  try {
    const results = await Promise.all(checks.map((check) => check()));
    return results.every(Boolean);
  } catch {
    return false;
  }
}

function enforceHttps(request: IncomingMessage, required: boolean): void {
  if (!required) return;
  const forwarded = firstHeader(request.headers['x-forwarded-proto']);
  const encrypted = Boolean((request.socket as { encrypted?: boolean }).encrypted);
  if (!encrypted && forwarded !== 'https') {
    throw new GatewayError('invalid_request', 'HTTPS is required', 400);
  }
}

function enforceOrigin(request: IncomingMessage, allowed: ReadonlySet<string>): void {
  const origin = request.headers.origin;
  if (origin && !allowed.has(origin)) {
    throw new GatewayError('invalid_request', 'Origin is not allowed', 403);
  }
}

function enforceMediaTypes(request: IncomingMessage): void {
  const contentType = request.headers['content-type'] ?? '';
  const accept = request.headers.accept ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new GatewayError('invalid_request', 'Content-Type must be application/json', 415);
  }
  if (!accept.includes('application/json') || !accept.includes('text/event-stream')) {
    throw new GatewayError(
      'invalid_request',
      'Accept must include application/json and text/event-stream',
      406,
    );
  }
}

async function readJson(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  const contentLength = Number(request.headers['content-length'] ?? 0);
  if (contentLength > maxBytes)
    throw new GatewayError('invalid_request', 'Request body is too large', 413);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes)
      throw new GatewayError('invalid_request', 'Request body is too large', 413);
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) {
    throw new GatewayError('invalid_request', 'Request body is not valid JSON', 400, {
      cause: error,
    });
  }
}

function requestedTool(body: unknown): string | undefined {
  if (!isRecord(body)) throw new GatewayError('invalid_request', 'JSON-RPC body is invalid', 400);
  if (body.method !== 'tools/call') return undefined;
  if (!isRecord(body.params) || typeof body.params.name !== 'string') {
    throw new GatewayError('invalid_request', 'Tool call is invalid', 400);
  }
  return body.params.name;
}

function bearerToken(request: IncomingMessage): string | undefined {
  const match = request.headers.authorization?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1];
}

function requestContext(request: IncomingMessage, startedAt: number): RequestContext {
  return {
    requestId: randomUUID(),
    startedAt,
    clientIpHash: sha256(request.socket.remoteAddress ?? 'unknown'),
    userAgentHash: sha256(request.headers['user-agent'] ?? 'unknown'),
  };
}

function challenge(metadataUrl: string, scope: string | undefined, insufficient: boolean): string {
  const values = [
    `resource_metadata="${metadataUrl}"`,
    `scope="${scope ?? BASE_SCOPE}"`,
    ...(insufficient ? ['error="insufficient_scope"'] : []),
  ];
  return `Bearer ${values.join(', ')}`;
}

function rpcCode(status: number): number {
  if (status === 401) return -32001;
  if (status === 403) return -32003;
  if (status === 429) return -32029;
  if (status >= 500) return -32603;
  return -32600;
}

function isMetadataPath(path: string | undefined): boolean {
  return (
    path === '/.well-known/oauth-protected-resource' ||
    path === '/.well-known/oauth-protected-resource/mcp'
  );
}

function canonicalUrl(value: string): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new TypeError('publicUrl must use HTTP(S)');
  return url;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value?.split(',')[0]?.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

class ConcurrencyLimiter {
  readonly #limit: number;
  #active = 0;

  constructor(limit: number) {
    if (!Number.isInteger(limit) || limit < 1)
      throw new TypeError('maxConcurrency must be positive');
    this.#limit = limit;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#active >= this.#limit) {
      throw new GatewayError('quota_exhausted', 'Gateway is at capacity', 429, {
        retryAfterSeconds: 1,
      });
    }
    this.#active += 1;
    try {
      return await operation();
    } finally {
      this.#active -= 1;
    }
  }
}
