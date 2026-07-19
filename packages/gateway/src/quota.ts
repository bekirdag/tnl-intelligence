import type { QuotaDecision, QuotaRequest, QuotaStore } from './contracts.js';
import { GatewayError } from './errors.js';
import { isResearchTool } from './policy.js';

interface Counter {
  count: number;
  resetAt: number;
}

export class InMemoryQuotaStore implements QuotaStore {
  readonly #counters = new Map<string, Counter>();

  async consume(request: QuotaRequest): Promise<QuotaDecision> {
    const windowStart = Math.floor(request.now / 60_000) * 60_000;
    const resetAt = windowStart + 60_000;
    const dimensions: Array<{
      key: string;
      limit: number;
      reason: Exclude<QuotaDecision['reason'], 'allowed'>;
    }> = [
      {
        key: `global:${windowStart}`,
        limit: request.limits.globalPerMinute,
        reason: 'global_limit',
      },
      {
        key: `tenant:${request.principal.tenantId}:${windowStart}`,
        limit: request.limits.tenantPerMinute,
        reason: 'tenant_limit',
      },
      {
        key: `principal:${request.principal.tenantId}:${request.principal.id}:${windowStart}`,
        limit: request.limits.principalPerMinute,
        reason: 'principal_limit',
      },
      {
        key: `client:${request.principal.tenantId}:${request.principal.clientId}:${windowStart}`,
        limit: request.limits.clientPerMinute,
        reason: 'client_limit',
      },
    ];
    if (isResearchTool(request.tool)) {
      dimensions.push({
        key: `research:${request.principal.tenantId}:${request.principal.id}:${windowStart}`,
        limit: request.limits.researchPerMinute,
        reason: 'research_limit',
      });
    }
    for (const dimension of dimensions) {
      const counter = this.#counters.get(dimension.key);
      if ((counter?.count ?? 0) >= dimension.limit) {
        return {
          allowed: false,
          reason: dimension.reason,
          retryAfterSeconds: Math.max(1, Math.ceil((resetAt - request.now) / 1_000)),
          remaining: 0,
          resetAt,
        };
      }
    }
    let remaining = Number.MAX_SAFE_INTEGER;
    for (const dimension of dimensions) {
      const count = (this.#counters.get(dimension.key)?.count ?? 0) + 1;
      this.#counters.set(dimension.key, { count, resetAt });
      remaining = Math.min(remaining, Math.max(0, dimension.limit - count));
    }
    if (this.#counters.size > 10_000) this.#prune(request.now);
    return { allowed: true, reason: 'allowed', retryAfterSeconds: 0, remaining, resetAt };
  }

  #prune(now: number): void {
    for (const [key, counter] of this.#counters) {
      if (counter.resetAt <= now) this.#counters.delete(key);
    }
  }
}

export interface HttpQuotaStoreOptions {
  endpoint: string;
  serviceToken: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export class HttpQuotaStore implements QuotaStore {
  readonly #options: HttpQuotaStoreOptions;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: HttpQuotaStoreOptions) {
    if (new URL(options.endpoint).protocol !== 'https:') {
      throw new TypeError('Production quota service must use HTTPS');
    }
    this.#options = options;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async consume(request: QuotaRequest): Promise<QuotaDecision> {
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
          tenantId: request.principal.tenantId,
          principalId: request.principal.id,
          clientId: request.principal.clientId,
          tool: request.tool,
          limits: request.limits,
          timestamp: new Date(request.now).toISOString(),
        }),
        signal: AbortSignal.timeout(this.#options.timeoutMs ?? 3_000),
      });
    } catch (error) {
      throw new GatewayError('dependency_unavailable', 'Quota service is unavailable', 503, {
        cause: error,
      });
    }
    if (!response.ok) {
      throw new GatewayError('dependency_unavailable', 'Quota service is unavailable', 503);
    }
    const value = (await response.json()) as Partial<QuotaDecision>;
    if (
      typeof value.allowed !== 'boolean' ||
      typeof value.reason !== 'string' ||
      typeof value.retryAfterSeconds !== 'number' ||
      typeof value.remaining !== 'number' ||
      typeof value.resetAt !== 'number'
    ) {
      throw new GatewayError('dependency_unavailable', 'Quota service response is invalid', 503);
    }
    return value as QuotaDecision;
  }
}
