import { request as requestHttp } from 'node:http';
import { request as requestHttps } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import {
  EndpointPolicyError,
  validateEndpoint,
  type EndpointPolicy,
  type EndpointResolver,
} from './endpoint.js';

export interface DeliveryTransportRequest {
  endpoint: string;
  rawBody: Buffer;
  headers: Readonly<Record<string, string>>;
  timeoutMs: number;
}

export interface DeliveryTransportResponse {
  status: number;
  headers: Readonly<Record<string, string>>;
  latencyMs: number;
}

export interface DeliveryTransport {
  send(request: DeliveryTransportRequest): Promise<DeliveryTransportResponse>;
}

export class PinnedHttpDeliveryTransport implements DeliveryTransport {
  constructor(
    readonly resolver: EndpointResolver,
    readonly endpointPolicy: EndpointPolicy = {},
  ) {}

  async send(input: DeliveryTransportRequest): Promise<DeliveryTransportResponse> {
    if (input.rawBody.length > 64 * 1024) throw new DeliveryTransportError('body_too_large', false);
    let validated;
    try {
      validated = await validateEndpoint(input.endpoint, this.resolver, this.endpointPolicy);
    } catch (error) {
      if (error instanceof EndpointPolicyError)
        throw new DeliveryTransportError(error.code, false, true);
      throw new DeliveryTransportError('dns_failure', true);
    }
    const url = new URL(validated.url);
    const address = validated.addresses[0] as string;
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const send = url.protocol === 'https:' ? requestHttps : requestHttp;
      const request = send(
        url,
        {
          method: 'POST',
          headers: {
            ...input.headers,
            'content-type': 'application/json',
            'content-length': String(input.rawBody.length),
            'user-agent': 'tnl-webhooks/1.0',
          },
          servername: url.hostname,
          lookup: pinnedLookup(address),
          maxHeaderSize: 16_384,
        },
        (response) => {
          const headers: Record<string, string> = {};
          for (const [name, value] of Object.entries(response.headers)) {
            if (typeof value === 'string') headers[name.toLowerCase()] = value.slice(0, 500);
          }
          response.resume();
          response.once('end', () =>
            resolve({
              status: response.statusCode ?? 0,
              headers,
              latencyMs: Date.now() - started,
            }),
          );
        },
      );
      request.setTimeout(input.timeoutMs, () => request.destroy(new Error('timeout')));
      request.once('error', (error) => {
        const code = error.message === 'timeout' ? 'timeout' : 'network_failure';
        reject(new DeliveryTransportError(code, true));
      });
      request.end(input.rawBody);
    });
  }
}

function pinnedLookup(address: string): LookupFunction {
  return (_hostname, options, callback) => {
    const family = isIP(address);
    if (options.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
}

export class DeliveryTransportError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly security = false,
  ) {
    super(code);
    this.name = 'DeliveryTransportError';
  }
}
