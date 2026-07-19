import type { AuditEvent, AuditSink } from './contracts.js';
import { GatewayError } from './errors.js';

const ALLOWED_KEYS = new Set([
  'timestamp',
  'type',
  'requestId',
  'outcome',
  'reason',
  'durationMs',
  'principalIdHash',
  'tenantIdHash',
  'clientIdHash',
  'tool',
  'policyVersion',
]);

export class JsonAuditSink implements AuditSink {
  readonly #write: (line: string) => void;

  constructor(write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)) {
    this.#write = write;
  }

  async emit(event: AuditEvent): Promise<void> {
    const value = event as unknown as Record<string, unknown>;
    if (Object.keys(value).some((key) => !ALLOWED_KEYS.has(key))) {
      throw new TypeError('Audit event includes a forbidden field');
    }
    this.#write(JSON.stringify(event));
  }
}

export interface HttpAuditSinkOptions {
  endpoint: string;
  serviceToken: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export class HttpAuditSink implements AuditSink {
  readonly #options: HttpAuditSinkOptions;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: HttpAuditSinkOptions) {
    if (new URL(options.endpoint).protocol !== 'https:') {
      throw new TypeError('Production audit service must use HTTPS');
    }
    this.#options = options;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async emit(event: AuditEvent): Promise<void> {
    let response: Response;
    try {
      response = await this.#fetch(this.#options.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.#options.serviceToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(this.#options.timeoutMs ?? 3_000),
      });
    } catch (error) {
      throw new GatewayError('dependency_unavailable', 'Audit service is unavailable', 503, {
        cause: error,
      });
    }
    if (!response.ok) {
      throw new GatewayError('dependency_unavailable', 'Audit service is unavailable', 503);
    }
  }
}

export class MemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  async emit(event: AuditEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }
}
