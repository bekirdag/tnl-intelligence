import type { TnlToolName } from '@theneuralledger/mcp';
import type {
  AccessContext,
  AccessResolver,
  Entitlement,
  Principal,
  QuotaLimits,
  VerifiedToken,
} from './contracts.js';
import { GatewayError } from './errors.js';

export interface StaticAccessRecord {
  principalId: string;
  tenantId: string;
  status: Entitlement['status'];
  plan: string;
  version: string;
  allowedScopes: readonly string[];
  allowedTools?: readonly TnlToolName[];
  quota: QuotaLimits;
}

export class StaticAccessResolver implements AccessResolver {
  readonly #records: ReadonlyMap<string, StaticAccessRecord>;

  constructor(records: ReadonlyMap<string, StaticAccessRecord>) {
    this.#records = records;
  }

  async resolve(token: VerifiedToken): Promise<AccessContext> {
    const record = this.#records.get(`${token.issuer}|${token.subject}`);
    if (!record || (token.tenantHint && token.tenantHint !== record.tenantId)) {
      throw new GatewayError('identity_mapping_failed', 'Identity mapping is invalid', 403);
    }
    return accessContext(token, record);
  }
}

export interface HttpAccessResolverOptions {
  endpoint: string;
  serviceToken: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export class HttpAccessResolver implements AccessResolver {
  readonly #options: HttpAccessResolverOptions;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: HttpAccessResolverOptions) {
    if (new URL(options.endpoint).protocol !== 'https:') {
      throw new TypeError('Production access resolver must use HTTPS');
    }
    this.#options = options;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async resolve(token: VerifiedToken): Promise<AccessContext> {
    let response: Response;
    try {
      response = await this.#fetch(this.#options.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.#options.serviceToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          issuer: token.issuer,
          subject: token.subject,
          clientId: token.clientId,
          tokenIdHash: token.tokenIdHash,
          tenantHint: token.tenantHint,
        }),
        signal: AbortSignal.timeout(this.#options.timeoutMs ?? 5_000),
      });
    } catch (error) {
      throw new GatewayError('dependency_unavailable', 'Access service is unavailable', 503, {
        cause: error,
      });
    }
    if (response.status === 404 || response.status === 409) {
      throw new GatewayError('identity_mapping_failed', 'Identity mapping is invalid', 403);
    }
    if (!response.ok) {
      throw new GatewayError('dependency_unavailable', 'Access service is unavailable', 503);
    }
    const record = validateRecord((await response.json()) as unknown);
    if (token.tenantHint && token.tenantHint !== record.tenantId) {
      throw new GatewayError('identity_mapping_failed', 'Identity mapping is invalid', 403);
    }
    return accessContext(token, record);
  }
}

function accessContext(token: VerifiedToken, record: StaticAccessRecord): AccessContext {
  const scopes = intersect(token.scopes, new Set(record.allowedScopes));
  const principal: Principal = {
    id: record.principalId,
    tenantId: record.tenantId,
    subject: token.subject,
    issuer: token.issuer,
    clientId: token.clientId,
    scopes,
    tokenIdHash: token.tokenIdHash,
    authenticationMethod: 'oauth_access_token',
  };
  return {
    principal,
    entitlement: {
      status: record.status,
      plan: record.plan,
      version: record.version,
      allowedScopes: new Set(record.allowedScopes),
      ...(record.allowedTools ? { allowedTools: new Set(record.allowedTools) } : {}),
      quota: record.quota,
    },
  };
}

function validateRecord(value: unknown): StaticAccessRecord {
  if (!isRecord(value))
    throw new GatewayError('dependency_unavailable', 'Invalid access response', 503);
  const quota = value.quota;
  const allowedScopes = value.allowedScopes;
  if (
    typeof value.principalId !== 'string' ||
    typeof value.tenantId !== 'string' ||
    !['active', 'suspended', 'expired'].includes(String(value.status)) ||
    typeof value.plan !== 'string' ||
    typeof value.version !== 'string' ||
    !Array.isArray(allowedScopes) ||
    !allowedScopes.every((scope) => typeof scope === 'string') ||
    !isQuota(quota)
  ) {
    throw new GatewayError('dependency_unavailable', 'Invalid access response', 503);
  }
  const allowedTools = Array.isArray(value.allowedTools)
    ? value.allowedTools.filter((tool): tool is TnlToolName => typeof tool === 'string')
    : undefined;
  return {
    principalId: value.principalId,
    tenantId: value.tenantId,
    status: value.status as Entitlement['status'],
    plan: value.plan,
    version: value.version,
    allowedScopes,
    ...(allowedTools ? { allowedTools } : {}),
    quota,
  };
}

function isQuota(value: unknown): value is QuotaLimits {
  return (
    isRecord(value) &&
    [
      'globalPerMinute',
      'tenantPerMinute',
      'principalPerMinute',
      'clientPerMinute',
      'researchPerMinute',
    ].every(
      (key) => typeof value[key] === 'number' && Number.isInteger(value[key]) && value[key] >= 0,
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function intersect(left: ReadonlySet<string>, right: ReadonlySet<string>): ReadonlySet<string> {
  return new Set([...left].filter((value) => right.has(value)));
}
