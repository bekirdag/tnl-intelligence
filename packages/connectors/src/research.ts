import {
  validateResearchResult,
  type ResearchResult,
  type ResearchTask,
} from '@theneuralledger/research';
import type { ConnectorResearchRunner } from './client.js';
import { ConnectorError } from './errors.js';

export class HttpConnectorResearchRunner implements ConnectorResearchRunner {
  readonly #baseUrl: string;
  readonly #credential: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #timeoutMs: number;

  constructor(options: {
    baseUrl: string;
    credential: string;
    fetch?: typeof globalThis.fetch;
    timeoutMs?: number;
  }) {
    const url = new URL(options.baseUrl);
    if (!['https:', 'http:'].includes(url.protocol))
      throw new TypeError('Research URL must use HTTP or HTTPS');
    this.#baseUrl = url.toString().replace(/\/$/, '');
    this.#credential = options.credential.trim();
    if (!this.#credential) throw new TypeError('Research credential is required');
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#timeoutMs = options.timeoutMs ?? 45_000;
  }

  async run(task: ResearchTask): Promise<ResearchResult> {
    return this.#request('/api/research/runs', {
      method: 'POST',
      body: JSON.stringify({ task }),
    });
  }

  async getResult(resultId: string): Promise<ResearchResult | undefined> {
    let response: Response;
    try {
      response = await this.#fetch(
        `${this.#baseUrl}/api/research/runs/${encodeURIComponent(resultId)}`,
        {
          method: 'GET',
          headers: this.#headers(),
          signal: AbortSignal.timeout(this.#timeoutMs),
        },
      );
    } catch {
      throw new ConnectorError(
        'upstream_unavailable',
        'The research service is unavailable.',
        true,
      );
    }
    if (response.status === 404) return undefined;
    return this.#readResponse(response);
  }

  async #request(path: string, init: { method: 'POST'; body: string }): Promise<ResearchResult> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        ...init,
        headers: this.#headers(),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch {
      throw new ConnectorError(
        'upstream_unavailable',
        'The research service is unavailable.',
        true,
      );
    }
    return this.#readResponse(response);
  }

  async #readResponse(response: Response): Promise<ResearchResult> {
    if (response.status === 401 || response.status === 403)
      throw new ConnectorError(
        'permission_denied',
        'The connection lacks TNL research permission.',
        false,
      );
    if (response.status === 429)
      throw new ConnectorError('rate_limited', 'The research request limit is exhausted.', true);
    if (!response.ok)
      throw new ConnectorError(
        'upstream_unavailable',
        'The research service request failed.',
        response.status >= 500,
      );
    const payload = (await response.json()) as { data?: ResearchResult };
    if (!payload.data)
      throw new ConnectorError('upstream_unavailable', 'The research response is invalid.', true);
    try {
      validateResearchResult(payload.data);
    } catch {
      throw new ConnectorError('upstream_unavailable', 'The research response is invalid.', true);
    }
    return payload.data;
  }

  #headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.#credential}`,
      accept: 'application/json',
      'content-type': 'application/json',
    };
  }
}
