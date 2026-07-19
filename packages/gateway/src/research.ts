import type { TnlResearchRunner } from '@theneuralledger/mcp';
import {
  validateResearchResult,
  type ResearchResult,
  type ResearchTask,
} from '@theneuralledger/research';
import type { AccessContext, RequestContext } from './contracts.js';
import { GatewayError } from './errors.js';

export interface ResearchRunnerFactory {
  create(access: AccessContext, request: RequestContext): TnlResearchRunner;
  health?(): Promise<boolean>;
}

export interface HttpResearchRunnerFactoryOptions {
  endpoint: string;
  serviceToken: string;
  timeoutMs?: number;
  allowInsecureLoopback?: boolean;
  fetch?: typeof globalThis.fetch;
}

/**
 * Creates tenant-bound runners for the internal Tool 05 research service.
 * The service must validate the bearer token before accepting the identity headers.
 */
export class HttpResearchRunnerFactory implements ResearchRunnerFactory {
  readonly #endpoint: URL;
  readonly #serviceToken: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: HttpResearchRunnerFactoryOptions) {
    this.#endpoint = endpoint(options.endpoint, options.allowInsecureLoopback ?? false);
    this.#serviceToken = required(options.serviceToken, 'research service token');
    this.#timeoutMs = boundedTimeout(options.timeoutMs ?? 45_000);
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  create(access: AccessContext, request: RequestContext): TnlResearchRunner {
    const headers = {
      authorization: `Bearer ${this.#serviceToken}`,
      'x-request-id': request.requestId,
      'x-tnl-tenant-id': access.principal.tenantId,
      'x-tnl-user-id': access.principal.id,
    };
    return {
      run: async (task) =>
        this.#request('/api/research/runs', { method: 'POST', headers, body: { task } }),
      getResult: async (resultId) => {
        if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(resultId)) return undefined;
        try {
          return await this.#request(`/api/research/runs/${encodeURIComponent(resultId)}`, {
            method: 'GET',
            headers,
          });
        } catch (error) {
          if (error instanceof ResearchServiceError && error.status === 404) return undefined;
          throw error;
        }
      },
    };
  }

  async health(): Promise<boolean> {
    try {
      const response = await this.#fetch(new URL('/healthz', this.#endpoint), {
        method: 'GET',
        signal: AbortSignal.timeout(Math.min(this.#timeoutMs, 2_000)),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async #request(
    path: string,
    options: {
      method: 'GET' | 'POST';
      headers: Readonly<Record<string, string>>;
      body?: { task: ResearchTask };
    },
  ): Promise<ResearchResult> {
    let response: Response;
    try {
      response = await this.#fetch(new URL(path, this.#endpoint), {
        method: options.method,
        headers: {
          ...options.headers,
          accept: 'application/json',
          ...(options.body ? { 'content-type': 'application/json' } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (cause) {
      throw new GatewayError('dependency_unavailable', 'Research service is unavailable', 503, {
        cause,
      });
    }
    if (!response.ok) {
      throw new ResearchServiceError(response.status);
    }
    const payload = (await response.json()) as { data?: ResearchResult };
    if (!payload.data) {
      throw new GatewayError('dependency_unavailable', 'Research service response is invalid', 502);
    }
    try {
      validateResearchResult(payload.data);
    } catch (cause) {
      throw new GatewayError(
        'dependency_unavailable',
        'Research service response is invalid',
        502,
        {
          cause,
        },
      );
    }
    return payload.data;
  }
}

class ResearchServiceError extends GatewayError {
  constructor(readonly status: number) {
    super(
      'dependency_unavailable',
      status === 404 ? 'Research result was not found' : 'Research service request failed',
      status === 404 ? 404 : status === 429 ? 429 : 502,
    );
  }
}

function endpoint(value: string, allowInsecureLoopback: boolean): URL {
  const url = new URL(value);
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowInsecureLoopback && loopback)) {
    throw new TypeError('Research service endpoint must use HTTPS');
  }
  return new URL(url.toString().replace(/\/?$/, '/'));
}

function required(value: string, name: string): string {
  const result = value.trim();
  if (!result) throw new TypeError(`${name} is required`);
  return result;
}

function boundedTimeout(value: number): number {
  if (!Number.isInteger(value) || value < 1_000 || value > 120_000) {
    throw new TypeError('Research timeout must be an integer from 1000 to 120000');
  }
  return value;
}
