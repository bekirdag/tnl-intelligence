import { GatewayError } from './errors.js';
import { sha256, safeEqual } from './crypto.js';
import type { TokenVerifier, VerifiedToken } from './contracts.js';

interface IntrospectionResponse {
  active?: boolean;
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  scope?: string;
  client_id?: string;
  jti?: string;
  tenant_id?: string;
  organization?: string;
}

export interface IntrospectionTokenVerifierOptions {
  endpoint: string;
  clientId: string;
  clientSecret: string;
  issuer: string;
  audience: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  allowInsecureLoopback?: boolean;
}

export class IntrospectionTokenVerifier implements TokenVerifier {
  readonly #options: IntrospectionTokenVerifierOptions;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: IntrospectionTokenVerifierOptions) {
    assertSecureUrl(options.endpoint, options.allowInsecureLoopback ?? false);
    this.#options = options;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async verify(token: string, now = Date.now()): Promise<VerifiedToken> {
    const timeout = AbortSignal.timeout(this.#options.timeoutMs ?? 5_000);
    let response: Response;
    try {
      response = await this.#fetch(this.#options.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${this.#options.clientId}:${this.#options.clientSecret}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: new URLSearchParams({ token, token_type_hint: 'access_token' }),
        signal: timeout,
      });
    } catch (error) {
      throw new GatewayError('dependency_unavailable', 'Identity provider is unavailable', 503, {
        cause: error,
      });
    }
    if (!response.ok) {
      throw new GatewayError('dependency_unavailable', 'Identity provider is unavailable', 503);
    }
    const payload = (await response.json()) as IntrospectionResponse;
    validateIntrospection(payload, this.#options, now);
    const audience = array(payload.aud);
    return {
      issuer: payload.iss as string,
      subject: payload.sub as string,
      audience,
      scopes: new Set((payload.scope ?? '').split(/\s+/).filter(Boolean)),
      clientId: payload.client_id as string,
      tokenIdHash: sha256(payload.jti ?? token),
      expiresAt: (payload.exp as number) * 1_000,
      ...((payload.tenant_id ?? payload.organization)
        ? { tenantHint: payload.tenant_id ?? (payload.organization as string) }
        : {}),
    };
  }
}

export interface StaticTokenRecord extends Omit<VerifiedToken, 'scopes' | 'tokenIdHash'> {
  scopes: readonly string[];
}

export class StaticTokenVerifier implements TokenVerifier {
  readonly #records: ReadonlyMap<string, StaticTokenRecord>;

  constructor(records: ReadonlyMap<string, StaticTokenRecord>) {
    this.#records = records;
  }

  async verify(token: string, now = Date.now()): Promise<VerifiedToken> {
    let record: StaticTokenRecord | undefined;
    for (const [candidate, value] of this.#records) {
      if (safeEqual(candidate, token)) record = value;
    }
    if (!record || record.expiresAt <= now) {
      throw new GatewayError('invalid_token', 'Access token is invalid or expired', 401);
    }
    return { ...record, scopes: new Set(record.scopes), tokenIdHash: sha256(token) };
  }
}

function validateIntrospection(
  value: IntrospectionResponse,
  options: IntrospectionTokenVerifierOptions,
  now: number,
): void {
  const nowSeconds = Math.floor(now / 1_000);
  const audience = array(value.aud);
  if (
    value.active !== true ||
    value.iss !== options.issuer ||
    !audience.includes(options.audience) ||
    typeof value.sub !== 'string' ||
    !value.sub ||
    typeof value.client_id !== 'string' ||
    !value.client_id ||
    typeof value.exp !== 'number' ||
    value.exp <= nowSeconds ||
    (typeof value.nbf === 'number' && value.nbf > nowSeconds)
  ) {
    throw new GatewayError('invalid_token', 'Access token is invalid or expired', 401);
  }
}

function array(value: string | string[] | undefined): readonly string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function assertSecureUrl(value: string, allowInsecureLoopback: boolean): void {
  const url = new URL(value);
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowInsecureLoopback && loopback)) {
    throw new TypeError('OAuth endpoints must use HTTPS outside loopback development');
  }
}
