import type { CapabilityProvider, CapabilityRequest, UpstreamCapability } from './contracts.js';
import { GatewayError } from './errors.js';

export interface StaticCapabilityProviderOptions {
  accessToken: string;
  baseUrl: string;
  lifetimeMs?: number;
}

export class StaticCapabilityProvider implements CapabilityProvider {
  readonly #options: StaticCapabilityProviderOptions;

  constructor(options: StaticCapabilityProviderOptions) {
    this.#options = options;
  }

  async issue(request: CapabilityRequest): Promise<UpstreamCapability> {
    return {
      accessToken: this.#options.accessToken,
      baseUrl: this.#options.baseUrl,
      expiresAt: Math.min(request.expiresAt, Date.now() + (this.#options.lifetimeMs ?? 60_000)),
    };
  }
}

export interface HttpCapabilityProviderOptions {
  endpoint: string;
  serviceToken: string;
  audience: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export class HttpCapabilityProvider implements CapabilityProvider {
  readonly #options: HttpCapabilityProviderOptions;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: HttpCapabilityProviderOptions) {
    if (new URL(options.endpoint).protocol !== 'https:') {
      throw new TypeError('Production capability broker must use HTTPS');
    }
    this.#options = options;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async issue(request: CapabilityRequest): Promise<UpstreamCapability> {
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
          audience: this.#options.audience,
          principalId: request.principal.id,
          tenantId: request.principal.tenantId,
          clientId: request.principal.clientId,
          tools: [...request.tools],
          requestId: request.requestId,
          expiresAt: new Date(request.expiresAt).toISOString(),
        }),
        signal: AbortSignal.timeout(this.#options.timeoutMs ?? 5_000),
      });
    } catch (error) {
      throw new GatewayError('dependency_unavailable', 'Capability broker is unavailable', 503, {
        cause: error,
      });
    }
    if (!response.ok) {
      throw new GatewayError('dependency_unavailable', 'Capability broker is unavailable', 503);
    }
    const value = (await response.json()) as Record<string, unknown>;
    const expiresAt = Date.parse(String(value.expires_at ?? ''));
    if (
      typeof value.access_token !== 'string' ||
      !value.access_token ||
      typeof value.base_url !== 'string' ||
      !Number.isFinite(expiresAt) ||
      expiresAt > request.expiresAt
    ) {
      throw new GatewayError(
        'dependency_unavailable',
        'Capability broker response is invalid',
        503,
      );
    }
    if (new URL(value.base_url).protocol !== 'https:') {
      throw new GatewayError(
        'dependency_unavailable',
        'Capability broker response is invalid',
        503,
      );
    }
    return { accessToken: value.access_token, baseUrl: value.base_url, expiresAt };
  }
}
