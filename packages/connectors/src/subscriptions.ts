import type { TriggerFilter, TriggerSubscription, TriggerSubscriptionInput } from './contracts.js';
import { ConnectorError } from './errors.js';

export interface ConnectorSubscriptionClient {
  create(input: TriggerSubscriptionInput): Promise<TriggerSubscription>;
  remove(id: string): Promise<void>;
}

export class HttpConnectorSubscriptionClient implements ConnectorSubscriptionClient {
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
      throw new TypeError('Webhook control URL must use HTTP or HTTPS');
    this.#baseUrl = url.toString().replace(/\/$/, '');
    this.#credential = options.credential.trim();
    if (!this.#credential) throw new TypeError('Webhook credential is required');
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#timeoutMs = options.timeoutMs ?? 15_000;
  }

  async create(input: TriggerSubscriptionInput): Promise<TriggerSubscription> {
    const response = await this.#request('/v1/webhooks/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: validatedEndpoint(input.endpoint),
        eventTypes: input.eventTypes,
        ...(input.filters ? { filters: normalizeTriggerFilters(input.filters) } : {}),
        ...(input.secret ? { secret: input.secret } : {}),
      }),
    });
    const payload = (await response.json()) as {
      data?: {
        secret?: string;
        subscription?: { id?: string; state?: string; activeKeyId?: string };
      };
    };
    const subscription = payload.data?.subscription;
    if (!payload.data?.secret || !subscription?.id || !subscription.activeKeyId)
      throw new ConnectorError(
        'upstream_unavailable',
        'The webhook subscription response is invalid.',
        true,
      );
    return {
      id: subscription.id,
      secret: payload.data.secret,
      keyId: subscription.activeKeyId,
      state: subscription.state ?? 'pending',
    };
  }

  async remove(id: string): Promise<void> {
    await this.#request(`/v1/webhooks/subscriptions/${encodeURIComponent(identifier(id))}`, {
      method: 'DELETE',
    });
  }

  async #request(path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${this.#credential}`,
          accept: 'application/json',
          'content-type': 'application/json',
        },
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch {
      throw new ConnectorError('upstream_unavailable', 'The webhook service is unavailable.', true);
    }
    if (response.ok) return response;
    if (response.status === 401 || response.status === 403)
      throw new ConnectorError(
        'authentication_required',
        'The webhook connection must be authorized.',
        false,
      );
    if (response.status === 429)
      throw new ConnectorError(
        'rate_limited',
        'The webhook request limit is exhausted.',
        true,
        retryAfter(response),
      );
    if (response.status === 404)
      throw new ConnectorError('not_found', 'The webhook subscription was not found.', false);
    throw new ConnectorError(
      'upstream_unavailable',
      'The webhook service request failed.',
      response.status >= 500,
    );
  }
}

export function normalizeTriggerFilters(filters: TriggerFilter): TriggerFilter {
  const output: TriggerFilter = {};
  for (const field of ['categories', 'geographies', 'entities', 'assets', 'languages'] as const) {
    if (filters[field]) output[field] = boundedList(filters[field] as string[], field);
  }
  if (filters.minimumConfidence !== undefined) {
    if (filters.minimumConfidence < 0 || filters.minimumConfidence > 1)
      throw new ConnectorError('validation_error', 'minimumConfidence must be from 0 to 1', false);
    output.minimumConfidence = filters.minimumConfidence;
  }
  return output;
}

function validatedEndpoint(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost', '::1'].includes(url.hostname))
    throw new ConnectorError('validation_error', 'Webhook endpoint must use HTTPS', false);
  return url.toString();
}

function boundedList(values: string[], field: string): string[] {
  if (values.length > 100)
    throw new ConnectorError('validation_error', `${field} has too many values`, false);
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function identifier(value: string): string {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(value))
    throw new ConnectorError('validation_error', 'subscription ID is invalid', false);
  return value;
}

function retryAfter(response: Response): number | undefined {
  const value = Number(response.headers.get('retry-after'));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
